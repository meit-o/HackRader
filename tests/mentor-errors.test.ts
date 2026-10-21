import { describe, expect, it } from "vitest";
import { getMentorJoinErrorMessage } from "@/lib/mentor-errors";

describe("mentor join error messages", () => {
  it("points to the TypeORM migration health check for missing fields", () => {
    expect(
      getMentorJoinErrorMessage(
        new Error("Could not find the 'specialty' column of 'users' in the schema cache")
      )
    ).toContain("/api/health");
  });

  it("explains when an invite code is stale", () => {
    expect(getMentorJoinErrorMessage(new Error("Invite code was not found."))).toContain(
      "current invite"
    );
  });

  it("does not expose unknown database errors to the user", () => {
    expect(getMentorJoinErrorMessage(new Error("connection reset by peer"))).toBe(
      "Could not join as a mentor. Check the form and invite code, then try again."
    );
  });
});
