import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(), owner: vi.fn(), team: vi.fn(), invite: vi.fn(), createEvent: vi.fn()
}));
vi.mock("@/lib/session", () => ({ getCurrentIdentity: mocks.identity }));
vi.mock("@/lib/event-access", () => ({ getActiveEventOwner: mocks.owner }));
vi.mock("@/lib/store", () => ({
  getTeamById: mocks.team, createTeamInviteForTeam: mocks.invite,
  createTeamInvite: vi.fn(), getTeamInvites: vi.fn(), createEvent: mocks.createEvent
}));

import { POST as createInvite } from "@/app/api/admin/invites/route";
import { POST as createEvent } from "@/app/api/events/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GITHUB_CLIENT_ID", "client");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "secret");
  mocks.identity.mockResolvedValue({ login: "owner", githubId: 1, role: "admin", displayName: "Owner" });
  mocks.owner.mockResolvedValue({ event: { id: "owned-event" } });
});
afterEach(() => vi.unstubAllEnvs());

describe("security boundaries on management routes", () => {
  it("refuses to disclose another event's room invitation", async () => {
    mocks.team.mockResolvedValue({ id: "foreign-team", event_id: "foreign-event" });
    const response = await createInvite(new Request("https://hackradar.dev/api/admin/invites", {
      method: "POST", body: JSON.stringify({ teamId: "foreign-team" })
    }));
    expect(response.status).toBe(403);
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it("creates invitations for a team in the owner's event", async () => {
    mocks.team.mockResolvedValue({ id: "own-team", event_id: "owned-event" });
    mocks.invite.mockResolvedValue({ code: "ROOM-CODE" });
    const response = await createInvite(new Request("https://hackradar.dev/api/admin/invites", {
      method: "POST", body: JSON.stringify({ teamId: "own-team" })
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ invite: { code: "ROOM-CODE" } });
  });

  it("requires a GitHub identity before a guest mentor can become an organizer", async () => {
    mocks.identity.mockResolvedValue({ login: "mentor-guest", githubId: 0, role: "mentor" });
    const response = await createEvent(new Request("https://hackradar.dev/api/events", {
      method: "POST", body: JSON.stringify({ name: "Guest event" })
    }));
    expect(response.status).toBe(401);
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });
});
