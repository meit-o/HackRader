import { NextResponse } from "next/server";
import { getActiveEventOwner } from "@/lib/event-access";
import { listOrganizationRepositoryTargets, OrganizationRepositoryError } from "@/lib/github-organization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const access = await getActiveEventOwner();
  if (!access || access.identity.githubId <= 0) {
    return NextResponse.json({ error: "イベントの運営者としてGitHubでログインしてください。" }, { status: 403 });
  }
  try {
    const targets = await listOrganizationRepositoryTargets({
      login: access.identity.login,
      githubId: access.identity.githubId
    });
    return NextResponse.json(targets, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof OrganizationRepositoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "連携済みOrganizationを読み込めませんでした。もう一度お試しください。" }, { status: 502 });
  }
}
