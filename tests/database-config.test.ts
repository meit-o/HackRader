import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ initialize: vi.fn(), options: vi.fn() }));
vi.mock("typeorm", () => ({
  DataSource: class {
    constructor(options: unknown) { mocks.options(options); }
    initialize = mocks.initialize;
  }
}));
import { getDataSource } from "@/lib/database";

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.hackRadarDataSource = undefined;
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/audit?sslmode=require");
  vi.stubEnv("DATABASE_SSL", "true");
});
afterEach(() => {
  globalThis.hackRadarDataSource = undefined;
  vi.unstubAllEnvs();
});

describe("database transport and recovery", () => {
  it("enforces certificate verification even when the URL requests sslmode=require", async () => {
    mocks.initialize.mockResolvedValue({});
    await getDataSource();
    expect(mocks.options.mock.calls[0][0]).toMatchObject({ ssl: { rejectUnauthorized: true } });
    expect(new URL(mocks.options.mock.calls[0][0].url).searchParams.get("sslmode")).toBe("verify-full");
  });

  it("retries a failed initialization on the next request", async () => {
    mocks.initialize.mockRejectedValueOnce(new Error("temporary outage")).mockResolvedValueOnce({});
    await expect(getDataSource()).rejects.toThrow("temporary outage");
    await expect(getDataSource()).resolves.toEqual({});
    expect(mocks.initialize).toHaveBeenCalledTimes(2);
  });
});
