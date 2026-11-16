import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cookies: new Map<string, { value: string }>() }));

vi.mock("next/headers", () => ({ cookies: async () => mocks.cookies }));
vi.mock("@/lib/github-auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/github-auth")>(),
  exchangeCodeForToken: async () => ({ accessToken: "test-token", scopes: "read:user" }),
  fetchGitHubUser: async () => ({
    githubId: 1,
    login: "alice",
    displayName: "Alice",
    avatarUrl: null,
    role: "participant",
    issuedAt: Math.floor(Date.now() / 1000)
  })
}));

import { GET as authorize } from "@/app/api/auth/github/route";
import { GET as callback } from "@/app/api/auth/github/callback/route";
import { RETURN_TO_COOKIE, SESSION_COOKIE, STATE_COOKIE, getSafeReturnTo } from "@/lib/github-auth";

const origin = "https://www.hackradar.dev";

beforeEach(() => {
  vi.stubEnv("GITHUB_CLIENT_ID", "test-client");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "test-secret");
  vi.stubEnv("AUTH_SECRET", "test-auth-secret");
  mocks.cookies.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OAuth return destinations", () => {
  it.each([
    undefined,
    "",
    "https://outside.example/",
    "//outside.example/",
    "/\\outside.example/",
    "/\n/outside.example/",
    "/\t\\outside.example/",
    "/join/..//outside.example/",
    "/%2e//outside.example/"
  ])("keeps unsafe or missing destinations on the site: %s", (value) => {
    expect(getSafeReturnTo(value, origin)).toBe("/");
  });

  it("preserves invitation details and fragments for local destinations", () => {
    const path = "/?role=participant&code=ABCD-1234&room=5678#join";
    expect(getSafeReturnTo(path, origin)).toBe(path);
  });

  it("stores a safe fallback when a crafted return_to is supplied", async () => {
    const url = new URL("/api/auth/github", origin);
    url.searchParams.set("return_to", "/\\outside.example/");
    const response = await authorize(new Request(url));

    expect(response.status).toBe(307);
    expect(response.cookies.get(RETURN_TO_COOKIE)?.value).toBe("/");
    expect(new URL(response.headers.get("location")!).origin).toBe("https://github.com");
  });

  it("overwrites a previous attempt's return cookie when no destination is supplied", async () => {
    const response = await authorize(new Request(`${origin}/api/auth/github`, {
      headers: { cookie: `${RETURN_TO_COOKIE}=%2Fdashboard` }
    }));

    expect(response.cookies.get(RETURN_TO_COOKIE)?.value).toBe("/");
  });

  it.each(["/\\outside.example/", "/\n/outside.example/", "/join/..//outside.example/"])(
    "revalidates an unsafe cookie from an earlier login attempt: %s",
    async (returnTo) => {
      mocks.cookies.set(STATE_COOKIE, { value: "valid-state" });
      mocks.cookies.set(RETURN_TO_COOKIE, { value: returnTo });
      const response = await callback(new Request(
        `${origin}/api/auth/github/callback?code=test-code&state=valid-state`
      ));

      expect(response.headers.get("location")).toBe(`${origin}/?logged_in=1`);
      expect(response.cookies.get(SESSION_COOKIE)?.value).toBeTruthy();
    }
  );

  it("returns an authenticated participant to their invitation", async () => {
    const returnTo = "/?role=participant&code=ABCD-1234&room=5678";
    const authUrl = new URL("/api/auth/github", origin);
    authUrl.searchParams.set("return_to", returnTo);
    const authorization = await authorize(new Request(authUrl));
    mocks.cookies.set(STATE_COOKIE, { value: authorization.cookies.get(STATE_COOKIE)!.value });
    mocks.cookies.set(RETURN_TO_COOKIE, { value: authorization.cookies.get(RETURN_TO_COOKIE)!.value });

    const response = await callback(new Request(
      `${origin}/api/auth/github/callback?code=test-code&state=${mocks.cookies.get(STATE_COOKIE)!.value}`
    ));

    expect(response.headers.get("location")).toBe(`${origin}${returnTo}&logged_in=1`);
    expect(response.cookies.get(RETURN_TO_COOKIE)?.value).toBe("");
    expect(response.cookies.get(STATE_COOKIE)?.value).toBe("");
  });
});
