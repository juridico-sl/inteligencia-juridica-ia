from dataclasses import dataclass
import ipaddress
import os


def required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing configuration: {name}")
    return value


@dataclass(frozen=True)
class Settings:
    internal_secret: str
    datajud_api_key: str
    mcp_command: str = "mcp-juridico-brasil"
    mcp_timeout_seconds: float = 45.0
    rate_limit_per_minute: int = 60
    allowed_networks: tuple[str, ...] = ()
    allowed_hosts: tuple[str, ...] = ("127.0.0.1", "localhost", "testserver")
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    gateway_url: str = "http://127.0.0.1:8080"
    mimo_api_key: str | None = None
    mimo_base_url: str = "https://api.xiaomimimo.com/v1"
    mimo_model: str | None = None
    app_internal_url: str | None = None
    cron_secret: str | None = None
    event_webhook_url: str | None = None
    encryption_secret: str | None = None

    def __post_init__(self) -> None:
        if len(self.internal_secret) < 32:
            raise ValueError("MCP_INTERNAL_SECRET must contain at least 32 characters")
        if not 1 <= self.rate_limit_per_minute <= 10_000:
            raise ValueError("Invalid MCP_RATE_LIMIT_PER_MINUTE")
        if not self.allowed_hosts:
            raise ValueError("MCP_ALLOWED_HOSTS cannot be empty")
        for network in self.allowed_networks:
            ipaddress.ip_network(network.strip())

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            internal_secret=required("MCP_INTERNAL_SECRET"),
            datajud_api_key=required("DATAJUD_API_KEY"),
            mcp_command=os.getenv("MCP_COMMAND", "mcp-juridico-brasil"),
            mcp_timeout_seconds=float(os.getenv("MCP_TIMEOUT_SECONDS", "45")),
            rate_limit_per_minute=int(os.getenv("MCP_RATE_LIMIT_PER_MINUTE", "60")),
            allowed_networks=tuple(filter(None, os.getenv("MCP_ALLOWED_NETWORKS", "").split(","))),
            allowed_hosts=tuple(filter(None, os.getenv("MCP_ALLOWED_HOSTS", "127.0.0.1,localhost").split(","))),
            supabase_url=os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
            supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
            gateway_url=os.getenv("MCP_GATEWAY_URL", "http://127.0.0.1:8080"),
            mimo_api_key=os.getenv("MIMO_API_KEY"),
            mimo_base_url=os.getenv("MIMO_BASE_URL", "https://api.xiaomimimo.com/v1"),
            mimo_model=os.getenv("MIMO_MODEL"),
            app_internal_url=os.getenv("APP_INTERNAL_URL"),
            cron_secret=os.getenv("CRON_SECRET"),
            event_webhook_url=os.getenv("EVENT_WEBHOOK_URL"),
            encryption_secret=os.getenv("ENCRYPTION_SECRET"),
        )
