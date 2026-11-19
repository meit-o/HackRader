import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

function request(path: string, method = "GET", origin?: string) {
  return new NextRequest(`https://www.hackradar.dev${path}`, {
    method, headers: origin ? { origin } : undefined
  });
}

describe("request boundary", () => {
  it("fails closed when OAuth settings are missing outside demo mode", () => {
    vi.stubEnv("ENABLE_DEMO_MODE", "false");
    vi.stubEnv("GITHUB_CLIENT_ID", "");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    for (const path of ["/", "/dashboard", "/api/state", "/api/teams/join"]) {
      expect(proxy(request(path)).status).toBe(503);
    }
    expect(proxy(request("/api/health")).status).toBe(200);
    expect(proxy(request("/api/github/webhook", "POST")).status).toBe(200);
  });

  it("rejects cross-origin and missing-origin writes including multipart DM", () => {
    vi.stubEnv("ENABLE_DEMO_MODE", "true");
    for (const method of ["POST", "PATCH", "DELETE"]) {
      expect(proxy(request("/api/direct-messages", method, "https://evil.example")).status).toBe(403);
      expect(proxy(request("/api/direct-messages", method)).status).toBe(403);
      expect(proxy(request("/api/direct-messages", method, "https://www.hackradar.dev")).status).toBe(200);
    }
  });

  it("accepts the original local Host when Next normalizes the request URL", () => {
    vi.stubEnv("ENABLE_DEMO_MODE", "true");
    const normalized = new NextRequest("http://localhost:3100/api/events", {
      method: "POST", headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" }
    });
    expect(proxy(normalized).status).toBe(200);
  });
});
