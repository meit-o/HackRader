import { describe, expect, it } from "vitest";
import { hasEventEnded, normalizeEventSchedule } from "@/lib/event-schedule";
import { createEvent, saveEvent } from "@/lib/store";

describe("event schedule", () => {
  it("normalizes a valid date range and rejects a reversed one", () => {
    expect(
      normalizeEventSchedule({
        startsAt: "2026-10-01T00:00:00+09:00",
        endsAt: "2026-10-02T00:00:00+09:00"
      })
    ).toEqual({
      startsAt: "2026-09-30T15:00:00.000Z",
      endsAt: "2026-10-01T15:00:00.000Z"
    });
    expect(() =>
      normalizeEventSchedule({
        startsAt: "2026-10-02T00:00:00Z",
        endsAt: "2026-10-01T00:00:00Z"
      })
    ).toThrow("終了日時は開始日時より後");
  });

  it("keeps the configured period when an event is edited", async () => {
    const created = await createEvent({
      name: "Scheduled Event",
      ownerGithubUsername: "schedule-owner",
      startsAt: "2026-10-01T00:00:00Z",
      endsAt: "2026-10-02T00:00:00Z"
    });
    const updated = await saveEvent({ name: "Renamed Event", eventId: created.id });

    expect(updated.starts_at).toBe("2026-10-01T00:00:00.000Z");
    expect(updated.ends_at).toBe("2026-10-02T00:00:00.000Z");
  });

  it("unlocks cleanup only after the configured end", () => {
    const event = { ends_at: "2026-10-02T00:00:00Z" };
    expect(hasEventEnded(event, Date.parse("2026-10-01T23:59:59Z"))).toBe(false);
    expect(hasEventEnded(event, Date.parse("2026-10-02T00:00:00Z"))).toBe(true);
    expect(hasEventEnded({ ends_at: null }, Date.now())).toBe(false);
  });
});
