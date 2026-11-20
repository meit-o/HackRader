import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeOrganizationRepositoryCreation, listOrganizationRepositoryTargets } from "@/lib/github-organization";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const fetchMock = vi.fn();
const viewer = { login: "viewer", githubId: 123 };

beforeEach(() => {
  vi.stubEnv("GITHUB_APP_ID", "123");
  vi.stubEnv("GITHUB_APP_PRIVATE_KEY", privateKey.export({ type: "pkcs8", format: "pem" }).toString());
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

function installed(login: string, id: number) {
  return { id, account: { login }, target_type: "Organization", suspended_at: null };
}

describe("Organization discovery and ownership", () => {
  it("lists only active organizations owned by the logged-in GitHub identity", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const path = new URL(url).pathname;
      if (path === "/app") return json({ slug: "hackradar-test-app" });
      if (path === "/app/installations") return json([
        installed("owned-org", 1), installed("other-org", 2),
        { ...installed("suspended-org", 3), suspended_at: "2026-01-01" },
        { ...installed("personal-account", 4), target_type: "User" }
      ]);
      if (path.endsWith("/installation")) return json(installed(path.split("/")[2], 1));
      if (path.endsWith("/access_tokens")) return json({ token: "test-installation-token" });
      if (path === "/orgs/owned-org/memberships/viewer") return json({ state: "active", role: "admin", user: { id: 123 } });
      if (path === "/orgs/other-org/memberships/viewer") return json({ state: "active", role: "member", user: { id: 123 } });
      throw new Error(`Unexpected API path ${path}`);
    });
    const targets = await listOrganizationRepositoryTargets(viewer);
    expect(targets).toEqual({ organizations: ["owned-org"], installUrl: "https://github.com/apps/hackradar-test-app/installations/new" });
    expect(JSON.stringify(targets)).not.toContain("test-installation-token");
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("suspended-org") && !String(url).includes("personal-account"))).toBe(true);
  });

  it("rejects a username match with a different GitHub account ID", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/installation")) return json(installed("owned-org", 1));
      if (url.endsWith("/access_tokens")) return json({ token: "test-token" });
      return json({ state: "active", role: "admin", user: { id: 999 } });
    });
    await expect(authorizeOrganizationRepositoryCreation({ ...viewer, organization: "owned-org" })).rejects.toMatchObject({ status: 403 });
  });

  it("explains an uninstalled Organization without suggesting that its name is invalid", async () => {
    fetchMock.mockResolvedValue(json({ message: "Not Found" }, 404));
    await expect(authorizeOrganizationRepositoryCreation({ ...viewer, organization: "uninstalled-org" }))
      .rejects.toMatchObject({ status: 404, message: expect.stringContaining("「uninstalled-org」へのGitHub App") });
  });

  it("keeps upstream failures visible instead of returning an empty organization list", async () => {
    fetchMock.mockResolvedValueOnce(json({ slug: "hackradar" })).mockResolvedValueOnce(json({}, 502));
    await expect(listOrganizationRepositoryTargets(viewer)).rejects.toMatchObject({ status: 502 });
  });

  it("reads the next page of installations", async () => {
    fetchMock.mockResolvedValueOnce(json({ slug: "hackradar" }))
      .mockResolvedValueOnce(json(Array.from({ length: 100 }, () => ({ target_type: "User" }))))
      .mockResolvedValueOnce(json([]));
    expect((await listOrganizationRepositoryTargets(viewer)).organizations).toEqual([]);
    expect(fetchMock.mock.calls[2][0]).toContain("page=2");
  });
});
