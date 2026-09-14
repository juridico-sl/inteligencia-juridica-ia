import asyncio
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import logging
import os
import socket
from typing import Any
import httpx
from .config import Settings
from .schemas import MovementAnalysis

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("legal-worker")


class Worker:
    def __init__(self, settings: Settings):
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        self.settings = settings
        self.worker_id = f"{socket.gethostname()}:{os.getpid()}"
        self.db = httpx.AsyncClient(base_url=f"{settings.supabase_url.rstrip('/')}/rest/v1", headers={"apikey": settings.supabase_service_role_key, "Authorization": f"Bearer {settings.supabase_service_role_key}", "Content-Type": "application/json"}, timeout=45)
        self.storage = httpx.AsyncClient(base_url=f"{settings.supabase_url.rstrip('/')}/storage/v1", headers={"apikey": settings.supabase_service_role_key, "Authorization": f"Bearer {settings.supabase_service_role_key}", "Content-Type": "application/json"}, timeout=45)
        self.gateway = httpx.AsyncClient(base_url=settings.gateway_url.rstrip("/"), headers={"Authorization": f"Bearer {settings.internal_secret}"}, timeout=60)
        self.outbound = httpx.AsyncClient(timeout=180, follow_redirects=False)

    async def rpc(self, name: str, payload: dict[str, Any]) -> Any:
        response = await self.db.post(f"/rpc/{name}", json=payload)
        response.raise_for_status()
        return response.json() if response.content else None

    async def claim(self) -> list[dict[str, Any]]:
        return await self.rpc("claim_jobs", {"worker_id": self.worker_id, "batch_size": 10})

    async def run_job(self, job: dict[str, Any]) -> None:
        started = datetime.now(timezone.utc)
        try:
            handler = getattr(self, f"handle_{job['type']}", None)
            if not handler:
                raise RuntimeError(f"Unsupported job type: {job['type']}")
            await handler(job["payload"])
            await self.rpc("complete_job", {"job_id": job["id"]})
            logger.info(json.dumps({"job_id": job["id"], "type": job["type"], "status": "completed", "duration_ms": int((datetime.now(timezone.utc)-started).total_seconds()*1000)}))
        except Exception as exc:
            if job["type"] == "sync_process" and job.get("payload", {}).get("process_id"):
                process_id = job["payload"]["process_id"]
                await self.db.patch("/processes", params={"id": f"eq.{process_id}"}, json={"last_sync_error": type(exc).__name__})
                await self.db.post("/sync_logs", json={"process_id": process_id, "job_id": job["id"], "source": "DataJud", "status": "failed", "error_code": type(exc).__name__, "error_message": "Falha externa; dados anteriores preservados."})
            await self.rpc("retry_job", {"job_id": job["id"], "error_message": type(exc).__name__})
            logger.error(json.dumps({"job_id": job["id"], "type": job["type"], "status": "failed", "error": type(exc).__name__}))

    async def handle_sync_process(self, payload: dict[str, Any]) -> None:
        process_id = payload["process_id"]
        process_response = await self.db.get("/processes", params={"id": f"eq.{process_id}", "deleted_at": "is.null", "select": "*"})
        process_response.raise_for_status()
        rows = process_response.json()
        if not rows:
            raise RuntimeError("Process not found")
        process = rows[0]
        request = {"process_number": process["process_number"], "court": process.get("court")}
        details_response = await self.gateway.post("/processes/details", json=request, headers={"x-request-id": str(process_id)})
        details_response.raise_for_status()
        details = details_response.json().get("processo", {})
        if int(details.get("nivel_sigilo", 0)) > 0:
            raise RuntimeError("Sealed process cannot be persisted")
        update = {
            "court": details.get("tribunal"), "court_name": details.get("tribunal"), "judicial_class": details.get("classe_nome"),
            "judging_body": (details.get("orgao_julgador") or {}).get("nome"), "filing_date": details.get("data_ajuizamento"),
            "status": "active", "last_synced_at": datetime.now(timezone.utc).isoformat(), "last_sync_error": None,
            "metadata": {"grau": details.get("grau"), "assuntos": details.get("assuntos", []), "formato": details.get("formato"), "sistema": details.get("sistema"), "source": "DataJud"},
        }
        patch = await self.db.patch("/processes", params={"id": f"eq.{process_id}"}, json=update)
        patch.raise_for_status()
        court = details.get("tribunal")
        movements = details.get("movimentacoes", [])
        if court:
            movement_response = await self.gateway.post("/processes/movements", json={"process_number": process["process_number"], "court": court, "limit": 50})
            movement_response.raise_for_status()
            movements = movement_response.json().get("movimentacoes", movements)
        for movement in movements:
            description = movement.get("nome") or movement.get("description") or "Movimentação sem descrição"
            date = movement.get("data_hora") or movement.get("date")
            digest = hashlib.sha256(f"{date}|{movement.get('codigo','')}|{' '.join(description.lower().split())}".encode()).hexdigest()
            create = await self.db.post("/process_movements", params={"on_conflict": "process_id,content_hash", "select": "id"}, headers={"Prefer": "resolution=ignore-duplicates,return=representation"}, json={"process_id": process_id, "movement_code": str(movement.get("codigo") or ""), "movement_type": description[:200], "description": description, "movement_date": date, "source": "DataJud", "raw_data": movement, "content_hash": digest})
            create.raise_for_status()
            for row in create.json():
                await self.db.post("/job_queue", headers={"Prefer": "resolution=ignore-duplicates"}, params={"on_conflict": "idempotency_key"}, json={"type": "analyze_movement", "payload": {"movement_id": row["id"]}, "idempotency_key": f"analyze:{row['id']}"})
        await self._sync_parties(process_id, details.get("partes", []))
        await self.db.post("/sync_logs", json={"process_id": process_id, "source": "DataJud", "status": "success", "movements_received": len(movements)})

    async def _sync_parties(self, process_id: str, parties: list[dict[str, Any]]) -> None:
        for party in parties:
            name = " ".join(str(party.get("nome", "")).split())[:300]
            if not name:
                continue
            existing = await self.db.get("/parties", params={"name": f"eq.{name}", "select": "id", "limit": "1"})
            existing.raise_for_status()
            rows = existing.json()
            if rows:
                party_id = rows[0]["id"]
            else:
                created = await self.db.post("/parties", headers={"Prefer": "return=representation"}, params={"select": "id"}, json={"name": name, "type": "other", "metadata": {"datajud_type": party.get("tipo")}})
                created.raise_for_status(); party_id = created.json()[0]["id"]
            link = await self.db.post("/process_parties", headers={"Prefer": "resolution=ignore-duplicates"}, params={"on_conflict": "process_id,party_id,role"}, json={"process_id": process_id, "party_id": party_id, "role": str(party.get("polo") or party.get("tipo") or "parte")[:80], "is_client": False})
            link.raise_for_status()

    async def handle_analyze_movement(self, payload: dict[str, Any]) -> None:
        if not self.settings.mimo_api_key or not self.settings.mimo_model:
            raise RuntimeError("MiMo credentials missing")
        response = await self.db.get("/process_movements", params={"id": f"eq.{payload['movement_id']}", "select": "id,process_id,description,movement_date,source"})
        response.raise_for_status(); movement = response.json()[0]
        prompt = "Classifique somente o fato fornecido. Não invente. Retorne JSON: summary, relevance(info|attention|urgent), possible_deadline(boolean), deadline_date(ISO ou null), reason, suggested_action."
        ai_started = datetime.now(timezone.utc)
        ai = await self.outbound.post(f"{self.settings.mimo_base_url.rstrip('/')}/chat/completions", headers={"Authorization": f"Bearer {self.settings.mimo_api_key}"}, json={"model": self.settings.mimo_model, "temperature": 0.1, "response_format": {"type": "json_object"}, "messages": [{"role": "system", "content": prompt}, {"role": "user", "content": json.dumps({"source": movement["source"], "date": movement["movement_date"], "description": movement["description"]}, ensure_ascii=False)}]})
        ai.raise_for_status(); body = ai.json(); validated = MovementAnalysis.model_validate_json(body["choices"][0]["message"]["content"]); analysis = validated.model_dump(mode="json")
        update = await self.db.patch("/process_movements", params={"id": f"eq.{movement['id']}"}, json={"ai_summary": analysis["summary"], "ai_relevance": analysis["relevance"].replace("info", "informative"), "ai_analysis": analysis})
        update.raise_for_status()
        usage = body.get("usage", {})
        usage_log = await self.db.post("/ai_usage_logs", json={"feature": "movement_analysis", "model": self.settings.mimo_model, "input_tokens": usage.get("prompt_tokens", usage.get("input_tokens", 0)), "output_tokens": usage.get("completion_tokens", usage.get("output_tokens", 0)), "duration_ms": int((datetime.now(timezone.utc)-ai_started).total_seconds()*1000), "success": True})
        usage_log.raise_for_status()
        relevance = analysis.get("relevance", "info")
        if relevance in ("attention", "urgent"):
            await self.db.post("/alerts", headers={"Prefer": "resolution=ignore-duplicates"}, params={"on_conflict": "dedupe_key"}, json={"process_id": movement["process_id"], "type": "new_movement", "title": analysis.get("summary") or "Nova movimentação relevante", "description": analysis.get("reason"), "severity": relevance, "source_type": "process_movement", "source_id": movement["id"], "dedupe_key": f"movement:{movement['id']}"})
        if analysis.get("possible_deadline") and analysis.get("deadline_date"):
            await self.db.post("/deadlines", json={"process_id": movement["process_id"], "title": analysis.get("suggested_action") or "Prazo sugerido pela IA", "description": analysis.get("reason"), "due_at": analysis["deadline_date"], "origin": "AI", "status": "pending_confirmation", "priority": "high" if relevance == "urgent" else "medium", "source_id": movement["id"]})

    async def handle_extract_document(self, payload: dict[str, Any]) -> None:
        if not self.settings.app_internal_url or not self.settings.cron_secret:
            raise RuntimeError("APP_INTERNAL_URL or CRON_SECRET missing")
        response = await self.outbound.post(f"{self.settings.app_internal_url.rstrip('/')}/api/internal/documents/process", headers={"Authorization": f"Bearer {self.settings.cron_secret}"}, json={"id": payload["document_id"]})
        response.raise_for_status()

    async def handle_scan_deadlines(self, _: dict[str, Any]) -> None:
        now = datetime.now(timezone.utc); upcoming = now + timedelta(days=3)
        response = await self.db.get("/deadlines", params={"deleted_at": "is.null", "status": "in.(confirmed,pending_confirmation)", "due_at": f"lte.{upcoming.isoformat()}", "select": "id,process_id,title,due_at,status,responsible_user_id"})
        response.raise_for_status()
        for deadline in response.json():
            overdue = datetime.fromisoformat(deadline["due_at"].replace("Z", "+00:00")) < now
            if overdue and deadline["status"] == "confirmed":
                await self.db.patch("/deadlines", params={"id": f"eq.{deadline['id']}"}, json={"status": "overdue"})
            await self.db.post("/alerts", headers={"Prefer": "resolution=ignore-duplicates"}, params={"on_conflict": "dedupe_key"}, json={"process_id": deadline["process_id"], "type": "deadline_overdue" if overdue else "deadline_upcoming", "title": deadline["title"], "description": f"Prazo: {deadline['due_at']}", "severity": "urgent" if overdue else "attention", "source_type": "deadline", "source_id": deadline["id"], "assigned_to": deadline["responsible_user_id"], "dedupe_key": f"deadline:{deadline['id']}:{'overdue' if overdue else 'upcoming'}"})

    async def handle_send_notifications(self, _: dict[str, Any]) -> None:
        response = await self.db.get("/notifications", params={"status": "in.(pending,failed)", "attempts": "lt.5", "select": "id,channel,title,body,user_id,attempts,profiles(email)", "limit": "100"})
        response.raise_for_status()
        endpoints = {"email": os.getenv("EMAIL_WEBHOOK_URL"), "teams": os.getenv("TEAMS_WEBHOOK_URL"), "webhook": os.getenv("NOTIFICATION_WEBHOOK_URL")}
        for notification in response.json():
            try:
                if notification["channel"] != "in_app":
                    endpoint = endpoints.get(notification["channel"])
                    if not endpoint:
                        raise RuntimeError("Notification endpoint not configured")
                    outbound = await self.outbound.post(endpoint, json={"title": notification["title"], "body": notification["body"], "recipient": (notification.get("profiles") or {}).get("email")})
                    outbound.raise_for_status()
                await self.db.patch("/notifications", params={"id": f"eq.{notification['id']}"}, json={"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat()})
            except Exception as exc:
                await self.db.patch("/notifications", params={"id": f"eq.{notification['id']}"}, json={"status": "failed", "last_error": type(exc).__name__, "attempts": notification.get("attempts", 0) + 1})

    async def handle_process_outbox(self, _: dict[str, Any]) -> None:
        response=await self.db.get("/domain_events",params={"status":"in.(pending,failed)","available_at":f"lte.{datetime.now(timezone.utc).isoformat()}","select":"id,event_type,aggregate_type,aggregate_id,payload,attempts","order":"created_at","limit":"100"});response.raise_for_status()
        for event in response.json():
            try:
                if self.settings.event_webhook_url:
                    if not self.settings.encryption_secret:raise RuntimeError("ENCRYPTION_SECRET missing")
                    payload=json.dumps({"id":event["id"],"type":event["event_type"],"aggregate_type":event["aggregate_type"],"aggregate_id":event["aggregate_id"],"data":event["payload"]},separators=(",",":"),ensure_ascii=False).encode();signature=hmac.new(self.settings.encryption_secret.encode(),payload,hashlib.sha256).hexdigest();delivery=await self.outbound.post(self.settings.event_webhook_url,content=payload,headers={"content-type":"application/json","x-legal-signature":f"sha256={signature}","x-event-id":event["id"]});delivery.raise_for_status()
                await self.db.patch("/domain_events",params={"id":f"eq.{event['id']}"},json={"status":"completed","processed_at":datetime.now(timezone.utc).isoformat(),"last_error":None})
            except Exception as exc:
                attempts=int(event.get("attempts") or 0)+1;await self.db.patch("/domain_events",params={"id":f"eq.{event['id']}"},json={"status":"dead" if attempts>=5 else "failed","attempts":attempts,"available_at":(datetime.now(timezone.utc)+timedelta(seconds=min(3600,30*2**attempts))).isoformat(),"last_error":type(exc).__name__})

    async def handle_apply_retention(self, _: dict[str, Any]) -> None:
        response=await self.db.get("/system_settings",params={"key":"in.(retention.audit_days,retention.conversation_days,retention.document_days,retention.temporary_days)","select":"key,value"});response.raise_for_status();settings={row["key"]:int(row["value"]) for row in response.json()}
        now=datetime.now(timezone.utc);audit_before=(now-timedelta(days=settings.get("retention.audit_days",2555))).isoformat();conversation_before=(now-timedelta(days=settings.get("retention.conversation_days",730))).isoformat()
        for path,before in (("/audit_logs",audit_before),("/conversations",conversation_before)):
            deleted=await self.db.delete(path,params={"created_at":f"lt.{before}"});deleted.raise_for_status()
        temporary_before=(now-timedelta(days=settings.get("retention.temporary_days",7))).isoformat();deleted=await self.db.delete("/document_chunk_staging",params={"created_at":f"lt.{temporary_before}"});deleted.raise_for_status()
        document_before=(now-timedelta(days=settings.get("retention.document_days",3650))).isoformat();archived=await self.db.get("/documents",params={"deleted_at":f"lt.{document_before}","select":"id,storage_path","limit":"100"});archived.raise_for_status();rows=archived.json()
        if rows:
            ids=','.join(row['id'] for row in rows);versions=await self.db.get("/document_versions",params={"document_id":f"in.({ids})","select":"storage_path"});versions.raise_for_status();prefixes=[row["storage_path"] for row in rows]+[row["storage_path"] for row in versions.json()]
            removed=await self.storage.delete("/object/legal-documents",json={"prefixes":prefixes});removed.raise_for_status();purged=await self.db.delete("/documents",params={"id":f"in.({ids})"});purged.raise_for_status()

    async def handle_daily_report(self, payload: dict[str, Any]) -> None:
        await self._create_report("daily", payload)
    async def handle_weekly_report(self, payload: dict[str, Any]) -> None:
        await self._create_report("weekly", payload)
    async def handle_monthly_report(self, payload: dict[str, Any]) -> None:
        await self._create_report("monthly", payload)

    async def _create_report(self, period: str, _: dict[str, Any]) -> None:
        active = await self.db.get("/processes", params={"deleted_at": "is.null", "status": "eq.active", "select": "id"})
        critical = await self.db.get("/processes", params={"deleted_at": "is.null", "risk_level": "eq.critical", "select": "id,estimated_exposure"})
        active.raise_for_status(); critical.raise_for_status()
        sources = {"period": period, "active_processes": len(active.json()), "critical_processes": len(critical.json()), "critical_exposure": sum(float(row.get("estimated_exposure") or 0) for row in critical.json())}
        response = await self.db.post("/ai_insights", json={"type": f"{period}_report", "title": f"Relatório {period}", "description": "Resumo estruturado gerado exclusivamente de métricas do banco.", "source_data": sources, "confidence": 1, "status": "pending"})
        response.raise_for_status()

    async def close(self) -> None:
        await self.db.aclose(); await self.storage.aclose(); await self.gateway.aclose(); await self.outbound.aclose()


async def main() -> None:
    worker = Worker(Settings.from_env())
    try:
        while True:
            jobs = await worker.claim()
            if jobs:
                await asyncio.gather(*(worker.run_job(job) for job in jobs))
            else:
                await asyncio.sleep(5)
    finally:
        await worker.close()


if __name__ == "__main__":
    asyncio.run(main())
