import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

describe("proxy security", () => {
  it("lets the bearer-protected document worker reach its route and replaces untrusted request IDs", async () => {
    const request = new NextRequest("https://juridico.example/api/internal/documents/process", {
      method: "POST",
      headers: { "x-request-id": "invalid-id" },
    });
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
    expect(response.headers.get("x-request-id")).not.toBe("invalid-id");
  });

  it("keeps origin validation for cookie-authenticated API writes", async () => {
    const request = new NextRequest("https://juridico.example/api/v1/documents", {
      method: "POST",
      headers: { origin: "https://other.example" },
    });
    const response = await proxy(request);
    expect(response.status).toBe(403);
  });
});
