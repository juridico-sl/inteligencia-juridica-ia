from contextlib import asynccontextmanager
import json
import logging
import time
import uuid
from typing import Any
from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from .config import Settings
from .mcp_client import LegalMCPClient
from .schemas import DeadlineRequest, MonitorRequest, MovementRequest, ProcessRequest
from .security import Security

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("legal-mcp-gateway")


def create_app(settings: Settings | None = None, client: Any | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    mcp = client or LegalMCPClient(settings)
    security = Security(settings)
    metrics = {"requests": 0, "errors": 0, "mcp_duration_ms": 0}

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await mcp.connect()
        yield
        await mcp.close()

    app = FastAPI(title="Legal MCP Gateway", version="1.0.0", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(settings.allowed_hosts))

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))[:64]
        started = time.monotonic()
        metrics["requests"] += 1
        length = request.headers.get("content-length")
        if length and (not length.isdigit() or int(length) > 65_536):
            return JSONResponse({"error": "Request too large", "request_id": request_id}, status_code=413)
        try:
            response = await call_next(request)
        except Exception as exc:
            metrics["errors"] += 1
            logger.error(json.dumps({"request_id": request_id, "path": request.url.path, "status": 500, "error": type(exc).__name__}))
            response = JSONResponse({"error": "Internal gateway error", "request_id": request_id}, status_code=500)
        duration = int((time.monotonic() - started) * 1000)
        response.headers["x-request-id"] = request_id
        logger.info(json.dumps({"request_id": request_id, "path": request.url.path, "status": response.status_code, "duration_ms": duration}))
        return response

    async def authorized(request: Request) -> None:
        security.authorize(request, request.headers.get("authorization"))

    async def run(tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
        started = time.monotonic()
        result = await mcp.call(tool, arguments)
        metrics["mcp_duration_ms"] += int((time.monotonic() - started) * 1000)
        return result

    @app.get("/health")
    async def health():
        return {"status": "ok", "mcp": "connected"}

    @app.get("/metrics", response_class=PlainTextResponse, dependencies=[Depends(authorized)])
    async def get_metrics():
        return "\n".join(f"legal_mcp_{key} {value}" for key, value in metrics.items()) + "\n"

    @app.get("/courts", dependencies=[Depends(authorized)])
    async def courts():
        return await run("listar_tribunais", {})

    @app.get("/datajud/health", dependencies=[Depends(authorized)])
    async def datajud_health():
        await run("listar_tribunais", {})
        return {"status": "ok"}

    @app.post("/processes/search", dependencies=[Depends(authorized)])
    @app.post("/processes/details", dependencies=[Depends(authorized)])
    async def process_details(body: ProcessRequest):
        return await run("buscar_processo_por_numero", {"numero_processo": body.process_number, "tribunal": body.court})

    @app.post("/processes/movements", dependencies=[Depends(authorized)])
    async def movements(body: MovementRequest):
        return await run("listar_movimentacoes", {"numero_processo": body.process_number, "tribunal": body.court, "limite": body.limit})

    @app.post("/processes/summary", dependencies=[Depends(authorized)])
    async def summary(body: ProcessRequest):
        return await run("resumir_andamento", {"numero_processo": body.process_number, "tribunal": body.court})

    @app.post("/processes/monitor", dependencies=[Depends(authorized)])
    async def monitor(body: MonitorRequest):
        return await run("monitorar_processo", {"numero_processo": body.process_number, "tribunal": body.court, "desde_iso": body.since.isoformat()})

    @app.post("/processes/deadline", dependencies=[Depends(authorized)])
    async def deadline(body: DeadlineRequest):
        return await run("calcular_proximo_prazo", {"numero_processo": body.process_number, "tribunal": body.court, "tipo_ato": body.act_type, "uf": body.state, "data_intimacao_iso": body.service_date.isoformat() if body.service_date else None})

    return app


app = create_app()
