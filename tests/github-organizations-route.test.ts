import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ owner: vi.fn(), targets: vi.fn() }));
vi.mock("@/lib/event-access", () => ({ getActiveEventOwner: mocks.owner }));
vi.mock("@/lib/github-organization", async (original) => ({
  ...await original<typeof import("@/lib/github-organization")>(),
  listOrganizationRepositoryTargets: mocks.targets
}));
import { GET } from "@/app/api/github/organizations/route";

beforeEach(() => vi.clearAllMocks());

it("requires the current event's organizer before querying private installations", async () => {
  mocks.owner.mockResolvedValue(null);
  expect((await GET()).status).toBe(403);
  expect(mocks.targets).not.toHaveBeenCalled();
});

it("returns the organizer's allowed targets without caching", async () => {
  mocks.owner.mockResolvedValue({ identity: { login: "owner", githubId: 123 } });
  mocks.targets.mockResolvedValue({ organizations: ["owned-org"], installUrl: null });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({ organizations: ["owned-org"], installUrl: null });
});
