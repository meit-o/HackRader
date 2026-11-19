import { expect, it } from "vitest";
import { escapeLikePattern } from "@/lib/postgres-store";

// `.ilike()` is used in several places as a case-insensitive *exact* match
// (join codes, GitHub usernames). Without escaping, `%`/`_` act as SQL
// wildcards and can be sent by an unauthenticated caller, e.g.
// POST /api/judges/join { "code": "%" } previously matched any event's
// join_code and issued a judge session with no real invitation.
// escapeLikePattern() makes ILIKE comparisons behave like a literal
// equality check regardless of what the caller sends.

it("escapes the LIKE wildcard characters", () => {
  expect(escapeLikePattern("%")).toBe("\\%");
  expect(escapeLikePattern("_")).toBe("\\_");
  expect(escapeLikePattern("84AN-T7NA")).toBe("84AN-T7NA");
  expect(escapeLikePattern("__AN-T_NA")).toBe("\\_\\_AN-T\\_NA");
  expect(escapeLikePattern("%-%")).toBe("\\%-\\%");
});

it("escapes a literal backslash before escaping wildcards, so it cannot re-enable them", () => {
  // If `\` were escaped after `%`/`_`, this input could smuggle a raw
  // backslash in front of an escaped wildcard and undo the escaping.
  expect(escapeLikePattern("\\%")).toBe("\\\\\\%");
  expect(escapeLikePattern("a\\_b")).toBe("a\\\\\\_b");
});

it("leaves ordinary join codes and usernames untouched", () => {
  for (const value of ["ALPH-792AF", "alice-org", "mentor-9f3c1a2b", "Team One"]) {
    expect(escapeLikePattern(value)).toBe(value);
  }
});
