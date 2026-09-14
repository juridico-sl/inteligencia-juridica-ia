import hmac
import ipaddress
import time
from collections import defaultdict, deque
from fastapi import Header, HTTPException, Request
from .config import Settings


class Security:
    def __init__(self, settings: Settings):
        self.settings = settings
        # ponytail: per-instance window; move to Redis only if gateway scales horizontally.
        self.requests: dict[str, deque[float]] = defaultdict(deque)

    def authorize(self, request: Request, authorization: str | None = Header(default=None)) -> None:
        expected = f"Bearer {self.settings.internal_secret}"
        if not authorization or not hmac.compare_digest(authorization, expected):
            raise HTTPException(status_code=401, detail="Unauthorized")
        client = request.client.host if request.client else "unknown"
        if self.settings.allowed_networks and client != "unknown":
            address = ipaddress.ip_address(client)
            if not any(address in ipaddress.ip_network(network.strip()) for network in self.settings.allowed_networks):
                raise HTTPException(status_code=403, detail="Network not allowed")
        now = time.monotonic()
        window = self.requests[client]
        while window and window[0] < now - 60:
            window.popleft()
        if len(window) >= self.settings.rate_limit_per_minute:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        window.append(now)
