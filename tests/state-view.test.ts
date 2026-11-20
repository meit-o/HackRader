import { describe, expect, it } from "vitest";
import { createChatMessage, createEvent, createHelpPost, createTeamByName, getHackVerseState, recordActivity } from "@/lib/store";

describe("page-specific state snapshots", () => {
  it("keeps help and announcement data while excluding unrelated activity feeds", async () => {
    const event = await createEvent({ name: "Scoped views", ownerGithubUsername: "scoped-owner" });
    const team = await createTeamByName({ name: "Scoped team", eventId: event.id });
    await recordActivity({ teamId: team.id, type: "push", actorLogin: "scoped-author" });
    const post = await createHelpPost({ teamId: team.id, title: "Scoped question", body: "Question", category: "その他", authorGithub: "scoped-author" });
    await createChatMessage({ eventId: event.id, channel: "staff", authorName: "Owner", authorRole: "admin", body: "Scoped announcement" });
    const viewer = { githubUsername: "scoped-author", role: "participant" as const };
    const help = await getHackVerseState(event.id, viewer, "help");
    expect(help.helpPosts.map((item) => item.id)).toContain(post.id);
    expect(help.activities).toEqual([]);
    expect(help.contributors).toEqual([]);
    expect(help.messages).toEqual([]);
    const announcements = await getHackVerseState(event.id, viewer, "announcements");
    expect(announcements.messages.map((message) => message.body)).toContain("Scoped announcement");
    expect(announcements.helpPosts).toEqual([]);
    expect(announcements.activities).toEqual([]);
    const full = await getHackVerseState(event.id, viewer);
    expect(full.helpPosts.map((item) => item.id)).toContain(post.id);
    expect(full.activities).toHaveLength(1);
    expect(full.messages).toHaveLength(1);
  });
});
