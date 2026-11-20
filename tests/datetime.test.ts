import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateTime, formatShortDateTime } from "@/lib/datetime";

afterEach(() => vi.unstubAllEnvs());

describe("server and browser timestamp consistency", () => {
  it("renders identical question and chat timestamps in server and browser timezones", () => {
    const value = "2026-11-18T23:15:00.000Z";
    for (const timezone of ["UTC", "Asia/Tokyo", "America/Los_Angeles"]) {
      vi.stubEnv("TZ", timezone);
      expect(formatDateTime(value)).toBe("11月19日 08:15");
      expect(formatShortDateTime(value)).toBe("11/19 08:15");
    }
  });

  it("handles Tokyo midnight and invalid values", () => {
    expect(formatDateTime(new Date("2026-11-18T15:05:00Z"))).toBe("11月19日 00:05");
    expect(formatDateTime("invalid")).toBe("");
    expect(formatShortDateTime("invalid")).toBe("");
  });
});
