import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDataSource } from "@/lib/database";
import {
  acceptHelpReply, createEvent, createHelpPost, createHelpReply, createTeamByName,
  createTeamInviteForTeam, getHackVerseState, getMembershipInEvent, joinTeamWithInvite,
  recordActivity, saveScoreConfig, setTeamRepo, updateTeamCommitCount
} from "@/lib/store";
import type { DataSource } from "typeorm";
import type { HackEvent, Team, TeamInviteView } from "@/lib/types";

const auditUrl = process.env.TEST_DATABASE_URL;

// These tests perform writes and install a temporary trigger. Only a disposable
// local audit database is allowed, even if a production URL is supplied by mistake.
describe.skipIf(!auditUrl)("PostgreSQL security and concurrent workflows", () => {
  let source: DataSource;
  let event: HackEvent;
  let first: Team;
  let second: Team;
  let firstInvite: TeamInviteView;
  let secondInvite: TeamInviteView;

  beforeAll(async () => {
    const url = new URL(auditUrl!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/hackradar_audit") {
      throw new Error("Use a disposable 127.0.0.1/hackradar_audit database.");
    }
    vi.stubEnv("DATABASE_URL", auditUrl!);
    vi.stubEnv("DATABASE_SSL", "false");
    vi.stubEnv("AUTH_SECRET", "local-postgres-audit-secret");
    source = await getDataSource();
    const suffix = crypto.randomUUID().slice(0, 8);
    event = await createEvent({ name: `Postgres audit ${suffix}`, ownerGithubUsername: `audit-owner-${suffix}` });
    first = await createTeamByName({ name: "Audit A", eventId: event.id });
    second = await createTeamByName({ name: "Audit B", eventId: event.id });
    firstInvite = await createTeamInviteForTeam({ teamId: first.id, invitedBy: "Audit" });
    secondInvite = await createTeamInviteForTeam({ teamId: second.id, invitedBy: "Audit" });
  }, 30000);

  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
    globalThis.hackRadarDataSource = undefined;
    vi.unstubAllEnvs();
  });

  it("allows only one team when the same user joins two rooms concurrently", async () => {
    const githubUsername = `racing-${event.id}`;
    const results = await Promise.allSettled([firstInvite, secondInvite].map((invite) => joinTeamWithInvite({
      code: invite.code, githubUsername, displayName: "Concurrent participant", expectedEventId: event.id
    })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await getMembershipInEvent({ eventId: event.id, githubUsername })).not.toBeNull();
  });

  it("rolls back the user and team membership if event membership cannot be saved", async () => {
    await source.query(`CREATE OR REPLACE FUNCTION audit_reject_membership() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'audit simulated database failure'; END;
      $$ LANGUAGE plpgsql`);
    await source.query("CREATE TRIGGER audit_reject_membership BEFORE INSERT ON event_members FOR EACH ROW EXECUTE FUNCTION audit_reject_membership()");
    const githubUsername = `rollback-${event.id}`;
    try {
      await expect(joinTeamWithInvite({
        code: firstInvite.code, githubUsername, displayName: "Rollback participant"
      })).rejects.toThrow("audit simulated database failure");
      await expect(createEvent({ name: `Rollback ${event.id}`, ownerGithubUsername: githubUsername }))
        .rejects.toThrow("audit simulated database failure");
    } finally {
      await source.query("DROP TRIGGER audit_reject_membership ON event_members");
      await source.query("DROP FUNCTION audit_reject_membership()");
    }
    expect(await source.query("SELECT id FROM users WHERE github_username = $1", [githubUsername])).toHaveLength(0);
    expect(await source.query("SELECT id FROM events WHERE name = $1", [`Rollback ${event.id}`])).toHaveLength(0);
  });

  it("counts overlapping commit lists once during concurrent webhook deliveries", async () => {
    await setTeamRepo({ teamId: first.id, githubRepo: `audit/${event.id}` });
    const pushes = [
      { commitSha: "head-a", commitShas: ["shared", "head-a"], commitCount: 2 },
      { commitSha: "head-b", commitShas: ["shared", "head-b"], commitCount: 2 }
    ];
    await Promise.all(pushes.map((metadata, index) => recordActivity({
      type: "push", teamId: first.id, metadata, githubDeliveryId: `delivery-${event.id}-${index}`
    })));
    const state = await getHackVerseState(event.id);
    expect(state.teams.find((team) => team.id === first.id)).toMatchObject({ commit_count: 3, score: 2 });
    await recordActivity({
      type: "push", teamId: first.id, metadata: pushes[0], githubDeliveryId: `delivery-${event.id}-0`
    });
    expect((await getHackVerseState(event.id)).teams.find((team) => team.id === first.id)).toMatchObject({ commit_count: 3, score: 2 });
  });

  it("binds an accepted reply to its question and serializes concurrent selections", async () => {
    const firstPost = await createHelpPost({ teamId: first.id, title: "First", body: "Question one", category: "その他", authorGithub: "db-questioner" });
    const secondPost = await createHelpPost({ teamId: second.id, title: "Second", body: "Question two", category: "その他", authorGithub: "db-questioner" });
    const own = await createHelpReply({ helpPostId: firstPost.id, authorName: "Mentor", body: "Own answer" });
    const alternative = await createHelpReply({ helpPostId: firstPost.id, authorName: "Mentor", body: "Alternative" });
    const foreign = await createHelpReply({ helpPostId: secondPost.id, authorName: "Mentor", body: "Other answer" });
    await acceptHelpReply({ helpPostId: firstPost.id, replyId: own.id });
    await expect(acceptHelpReply({ helpPostId: firstPost.id, replyId: foreign.id })).rejects.toThrow();
    expect(await source.query("SELECT id FROM help_replies WHERE id = $1 AND is_accepted", [own.id])).toHaveLength(1);
    expect(await source.query("SELECT id FROM help_replies WHERE id = $1 AND is_accepted", [foreign.id])).toHaveLength(0);
    await Promise.all([own, alternative].map((reply) => acceptHelpReply({ helpPostId: firstPost.id, replyId: reply.id })));
    expect(await source.query("SELECT id FROM help_replies WHERE help_post_id = $1 AND is_accepted", [firstPost.id])).toHaveLength(1);
  });

  it("preserves reconciled commit totals and consistent scores when configuration and deliveries race", async () => {
    await updateTeamCommitCount(first.id, 50);
    await Promise.all([
      saveScoreConfig({ push: 7 }, event.id),
      recordActivity({ type: "push", teamId: first.id, githubDeliveryId: `score-race-${event.id}`, metadata: { commitSha: "score-race", commitShas: ["score-race"], commitCount: 1 } })
    ]);
    const state = await getHackVerseState(event.id);
    expect(state.teams.find((team) => team.id === first.id)).toMatchObject({ score: 21, commit_count: 51 });
    expect(state.activities.filter((activity) => activity.team_id === first.id).map((activity) => activity.score_delta)).toEqual([7, 7, 7]);
  });

  it("rejects a failed reply insert without reporting a successful memory-only reply", async () => {
    await expect(createHelpReply({
      helpPostId: crypto.randomUUID(), authorName: "Missing question", body: "Should fail"
    })).rejects.toThrow();
  });
});
