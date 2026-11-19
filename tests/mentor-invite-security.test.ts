import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMentorInviteCode } from "@/lib/mentor-invite";
import { createEvent, createTeamInvite, joinMentorByCode } from "@/lib/store";

beforeEach(() => vi.stubEnv("AUTH_SECRET", "mentor-invitation-test-secret"));
afterEach(() => vi.unstubAllEnvs());

describe("mentor invitation privileges", () => {
  it("rejects participant and team codes and accepts the owner's signed mentor invitation", async () => {
    const event = await createEvent({ name: "Mentor security event", ownerGithubUsername: "mentor-owner" });
    const room = await createTeamInvite({
      teamName: "Mentor security team", eventId: event.id, githubRepo: "owner/security", invitedBy: "Owner"
    });
    for (const code of [event.join_code, room.code]) {
      await expect(joinMentorByCode({
        code, displayName: "Guest", specialty: "TypeScript"
      })).rejects.toThrow("メンター専用");
    }
    const code = createMentorInviteCode(event);
    const session = await joinMentorByCode({ code, displayName: "Invited mentor", specialty: "TypeScript" });
    expect(session).toMatchObject({ eventId: event.id, role: "mentor" });
    await expect(joinMentorByCode({
      code: code.slice(0, -1) + (code.endsWith("0") ? "1" : "0"),
      displayName: "Forged mentor", specialty: "TypeScript"
    })).rejects.toThrow("メンター専用");
  });
});
