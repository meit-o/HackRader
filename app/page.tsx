import type { Metadata } from "next";
import { createMentorInviteCode } from "@/lib/mentor-invite";
import { IntroContent } from "@/components/intro-content";
import { OnboardingClient } from "@/components/onboarding-client";
import { getGitHubAppInstallUrl, isOrganizationRepositoryCreationConfigured } from "@/lib/github-organization";
import { getAuthStatus } from "@/lib/session";
import {
  getEvent,
  getEventsJoinedBy,
  getEventsOwnedBy,
  getHackVerseState,
  getTeamInvites
} from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "https://www.hackradar.dev/" }
};

export default async function Page() {
  const { isConfigured, identity } = await getAuthStatus();
  const [invites, state, hackEvent, ownedEvents, joinedEvents] = await Promise.all([
    // チームの部屋番号は運営だけが一覧で確認できるようにする。
    identity?.role === "admin" && identity.eventId ? getTeamInvites(identity.eventId) : Promise.resolve([]),
    identity?.eventId || !isConfigured ? getHackVerseState(identity?.eventId) : Promise.resolve({ teams: [], members: [] }),
    identity?.eventId || !isConfigured ? getEvent(identity?.eventId) : Promise.resolve(null),
    getEventsOwnedBy(identity?.login),
    getEventsJoinedBy(identity?.login)
  ]);

  const onboarding = (
    <OnboardingClient
      key={`${identity?.login ?? "guest"}:${identity?.eventId ?? "none"}:${identity?.role ?? "none"}`}
      initialInvites={invites}
      initialEvent={hackEvent && identity?.role === "admin"
        ? { ...hackEvent, mentor_invite_code: createMentorInviteCode(hackEvent) }
        : hackEvent}
      initialTeams={state.teams}
      // 所属の直しは運営だけの操作なので、他の役割には渡さない。
      initialMembers={identity?.role === "admin" ? state.members : []}
      ownedEvents={ownedEvents}
      joinedEvents={joinedEvents}
      authConfigured={isConfigured}
      organizationRepository={identity?.role === "admin"
        ? { configured: isOrganizationRepositoryCreationConfigured(), installUrl: getGitHubAppInstallUrl() }
        : null}
      viewer={
        identity
          ? {
              login: identity.login,
              displayName: identity.displayName,
              avatarUrl: identity.avatarUrl,
              role: identity.role
            }
          : null
      }
    />
  );

  // ログイン済みの表示は従来どおり。未ログインの初回訪問者には、
  // オンボーディングの上に紹介セクションを置いてアプリの内容を先に伝える。
  if (identity) {
    return onboarding;
  }

  return (
    <>
      <div className="bg-paper px-4 pt-10 sm:px-6 sm:pt-12">
        <div className="mx-auto w-full max-w-3xl">
          <IntroContent variant="top" />
        </div>
      </div>
      {onboarding}
    </>
  );
}
