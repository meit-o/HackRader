export function isDemoModeEnabled(): boolean {
  if (process.env.ENABLE_DEMO_MODE !== undefined) return process.env.ENABLE_DEMO_MODE === "true";
  return process.env.NODE_ENV !== "production";
}
