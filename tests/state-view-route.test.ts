import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), state: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentIdentity: mocks.identity }));
vi.mock("@/lib/store", () => ({ getHackVerseState: mocks.state }));
import { GET } from "@/app/api/state/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.identity.mockResolvedValue({ login: "member", role: "participant", eventId: "own-event" });
  mocks.state.mockResolvedValue({ teams: [], helpPosts: [] });
});

it("requests a smaller snapshot for the current participant's help page", async () => {
  expect((await GET(new Request("https://hackradar.dev/api/state?view=help"))).status).toBe(200);
  expect(mocks.state).toHaveBeenCalledWith("own-event", { githubUsername: "member", role: "participant" }, "help");
});

it("preserves the complete snapshot for existing callers and unknown views", async () => {
  await GET(new Request("https://hackradar.dev/api/state?view=unknown"));
  expect(mocks.state).toHaveBeenCalledWith("own-event", expect.anything(), "dashboard");
});
