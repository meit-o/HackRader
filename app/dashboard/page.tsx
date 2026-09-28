import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard-client";
import { Shell } from "@/components/shell";
import { isDemoModeEnabled } from "@/lib/env";
import { getAuthStatus } from "@/lib/session";
import { getEvent, getHackVerseState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { isConfigured, identity } = await getAuthStatus();
  if (isConfigured && (!identity || !identity.eventId)) redirect("/");
  const [state, event] = await Promise.all([
    getHackVerseState(
      identity?.eventId,
      identity ? { githubUsername: identity.login, role: identity.role } : undefined
    ),
    getEvent(identity?.eventId)
  ]);
  const viewer = identity
    ? {
        login: identity.login,
        displayName: identity.displayName,
        role: identity.role
      }
    : null;

  return (
    <Shell>
      <DashboardClient
        initialState={state}
        event={event}
        view="dashboard"
        viewer={viewer}
        demoEnabled={isDemoModeEnabled()}
      />
    </Shell>
  );
}
