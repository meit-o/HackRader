import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDataSource } from "@/lib/database";
import { createEvent, getEventByJoinCode, getEventIdForAccessCode } from "@/lib/store";
import type { DataSource } from "typeorm";
import type { HackEvent } from "@/lib/types";

const auditUrl = process.env.TEST_DATABASE_URL;

// Regression test for the unauthenticated auth-bypass fixed by escapeLikePattern():
// POST /api/judges/join (and anything else that resolves a code via
// getEventByJoinCode / getEventIdForAccessCode) must only accept the exact
// join code, never a SQL LIKE wildcard pattern. This exercises the real
// PostgreSQL ILIKE query, not a mock, since the bug lived in that query.
describe.skipIf(!auditUrl)("join-code lookup rejects SQL wildcard input", () => {
  let source: DataSource;
  let event: HackEvent;

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
    event = await createEvent({ name: `Wildcard audit ${suffix}`, ownerGithubUsername: `audit-owner-${suffix}` });
  }, 30000);

  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
    globalThis.hackRadarDataSource = undefined;
    vi.unstubAllEnvs();
  });

  it("does not match a bare '%' wildcard", async () => {
    expect(await getEventByJoinCode("%")).toBeNull();
    expect(await getEventIdForAccessCode("%")).toBeUndefined();
  });

  it("does not match '_' wildcards substituted for the real code's characters", async () => {
    const asUnderscores = event.join_code.replace(/[0-9]/g, "_");
    expect(await getEventByJoinCode(asUnderscores)).toBeNull();
  });

  it("does not match an unrelated pattern such as '%-%'", async () => {
    expect(await getEventByJoinCode("%-%")).toBeNull();
  });

  it("still matches the real join code, case-insensitively (no regression)", async () => {
    expect((await getEventByJoinCode(event.join_code))?.id).toBe(event.id);
    expect((await getEventByJoinCode(event.join_code.toLowerCase()))?.id).toBe(event.id);
    expect(await getEventIdForAccessCode(event.join_code)).toBe(event.id);
  });

  it("does not match an unrelated, non-wildcard code (control)", async () => {
    expect(await getEventByJoinCode("ZZZZ-ZZZZ")).toBeNull();
  });
});
