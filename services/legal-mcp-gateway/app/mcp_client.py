import asyncio
from contextlib import AsyncExitStack
import json
import os
from typing import Any
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from .config import Settings


class LegalMCPClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.stack: AsyncExitStack | None = None
        self.session: ClientSession | None = None
        self.lock = asyncio.Lock()

    async def connect(self) -> None:
        async with self.lock:
            if self.session:
                return
            stack = AsyncExitStack()
            env = os.environ.copy()
            env["DATAJUD_API_KEY"] = self.settings.datajud_api_key
            read, write = await stack.enter_async_context(stdio_client(StdioServerParameters(command=self.settings.mcp_command, args=[], env=env)))
            session = await stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
            self.stack, self.session = stack, session

    async def close(self) -> None:
        async with self.lock:
            if self.stack:
                await self.stack.aclose()
            self.stack, self.session = None, None

    async def call(self, tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
        for attempt in range(2):
            try:
                await self.connect()
                assert self.session
                async with asyncio.timeout(self.settings.mcp_timeout_seconds):
                    result = await self.session.call_tool(tool, arguments)
                if result.isError:
                    raise RuntimeError("MCP tool returned error")
                text = "".join(getattr(item, "text", "") for item in result.content)
                parsed = json.loads(text)
                return parsed if isinstance(parsed, dict) else {"data": parsed}
            except Exception:
                await self.close()
                if attempt:
                    raise
                await asyncio.sleep(0.25)
        raise RuntimeError("MCP unavailable")
