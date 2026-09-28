import { describe, expect, it } from "vitest";
import { normalizeGitHubRepo } from "@/lib/github-repo";

describe("normalizeGitHubRepo", () => {
  it("keeps an owner/repository value", () => {
    expect(normalizeGitHubRepo("  octo-org/hack-app  ")).toBe("octo-org/hack-app");
  });

  it("accepts a GitHub repository URL and removes a .git suffix", () => {
    expect(normalizeGitHubRepo("https://github.com/octo-org/hack-app.git/")).toBe(
      "octo-org/hack-app"
    );
  });

  it("rejects URLs that point below a repository", () => {
    expect(() => normalizeGitHubRepo("https://github.com/octo-org/hack-app/tree/main")).toThrow(
      "https://github.com/owner/repository"
    );
  });
});
