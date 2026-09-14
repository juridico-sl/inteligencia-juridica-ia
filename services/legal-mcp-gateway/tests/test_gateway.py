import os
import asyncio
os.environ.setdefault("MCP_INTERNAL_SECRET", "test-secret-with-at-least-32-characters")
os.environ.setdefault("DATAJUD_API_KEY", "test-key")

from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from app.schemas import MovementAnalysis
from app.worker import Worker


class FakeMCP:
    async def connect(self): pass
    async def close(self): pass
    async def call(self, tool, arguments): return {"tool": tool, "arguments": arguments}


settings = Settings(internal_secret="test-secret-with-at-least-32-characters", datajud_api_key="test-key")


def test_auth_and_process_validation():
    with TestClient(create_app(settings, FakeMCP())) as client:
        assert client.get("/courts").status_code == 401
        assert client.get("/datajud/health").status_code == 401
        invalid = client.post("/processes/details", headers={"Authorization": "Bearer test-secret-with-at-least-32-characters"}, json={"process_number": "123"})
        assert invalid.status_code == 422
        valid = client.post("/processes/details", headers={"Authorization": "Bearer test-secret-with-at-least-32-characters"}, json={"process_number": "00000000000000000000", "court": "tjsp"})
        assert valid.status_code == 200
        assert valid.json()["tool"] == "buscar_processo_por_numero"
        assert valid.json()["arguments"]["tribunal"] == "TJSP"
        assert client.get("/datajud/health", headers={"Authorization": "Bearer test-secret-with-at-least-32-characters"}).status_code == 200
        assert client.get("/openapi.json").status_code == 404
        assert client.post("/processes/details", headers={"Authorization": "Bearer test-secret-with-at-least-32-characters", "content-length": "65537"}, content=b"{}").status_code == 413


def test_strict_structured_output():
    valid = MovementAnalysis.model_validate({"summary": "Intimação publicada", "relevance": "attention", "possible_deadline": True, "deadline_date": "2026-09-10T12:00:00Z", "reason": "Possível prazo", "suggested_action": "Confirmar com advogado"})
    assert valid.possible_deadline is True
    try:
        MovementAnalysis.model_validate({**valid.model_dump(), "unexpected": True})
        assert False, "extra field should fail"
    except ValueError:
        pass


def test_retention_removes_storage_before_database_rows():
    class Response:
        def __init__(self, data=None): self.data = data or []
        def json(self): return self.data
        def raise_for_status(self): pass
    class Database:
        def __init__(self): self.deleted = []
        async def get(self, path, params=None):
            if path == "/system_settings": return Response([])
            if path == "/documents": return Response([{"id": "11111111-1111-1111-1111-111111111111", "storage_path": "original.pdf"}])
            return Response([{"storage_path": "version.pdf"}])
        async def delete(self, path, params=None): self.deleted.append((path, params)); return Response()
    class Storage:
        def __init__(self): self.prefixes = []
        async def delete(self, path, json=None): self.prefixes = json["prefixes"]; return Response()
    worker=object.__new__(Worker);worker.db=Database();worker.storage=Storage()
    asyncio.run(worker.handle_apply_retention({}))
    assert worker.storage.prefixes == ["original.pdf", "version.pdf"]
    assert worker.db.deleted[-1][0] == "/documents"
