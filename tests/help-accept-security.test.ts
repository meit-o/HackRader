import { describe, expect, it } from "vitest";
import { acceptHelpReply, createEvent, createHelpPost, createHelpReply, createTeamByName, getHackVerseState } from "@/lib/store";

describe("best answer integrity", () => {
  it("rejects replies from another question and preserves the existing answer", async () => {
    const event = await createEvent({ name: "Answer integrity", ownerGithubUsername: "answer-owner" });
    const team = await createTeamByName({ name: "Answer team", eventId: event.id });
    const first = await createHelpPost({ teamId: team.id, title: "First", body: "Question one", category: "その他", authorName: "Author" });
    const second = await createHelpPost({ teamId: team.id, title: "Second", body: "Question two", category: "その他", authorName: "Other" });
    const ownReply = await createHelpReply({ helpPostId: first.id, authorName: "Mentor", body: "First answer" });
    const otherReply = await createHelpReply({ helpPostId: second.id, authorName: "Mentor", body: "Other answer" });
    await acceptHelpReply({ helpPostId: first.id, replyId: ownReply.id });
    await expect(acceptHelpReply({ helpPostId: first.id, replyId: otherReply.id })).rejects.toThrow();
    const state = await getHackVerseState(event.id);
    expect(state.helpPosts.find((post) => post.id === first.id)?.replies[0].is_accepted).toBe(true);
    expect(state.helpPosts.find((post) => post.id === second.id)?.replies[0].is_accepted).toBe(false);
  });
});
