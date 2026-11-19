import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { getActiveEventOwner } from "@/lib/event-access";
import { isSameOriginRequest } from "@/lib/request-origin";
import {
  authorizeOrganizationRepositoryCreation,
  createOrganizationRepository,
  organizationNamePattern,
  OrganizationRepositoryError,
  repositoryNamePattern
} from "@/lib/github-organization";
import { ensureRepoWebhookWithToken } from "@/lib/github-webhook-setup";
import { notifyEventStateChanged } from "@/lib/realtime";
import { getTeamById } from "@/lib/store";
import type { Team } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "HackRadarの運営画面から操作してください。" }, { status: 403 });
  }

  const access = await getActiveEventOwner();
  if (!access || access.identity.githubId <= 0) {
    return NextResponse.json({ error: "イベントの運営者としてGitHubでログインしてください。" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { organization?: unknown; name?: unknown } | null;
  const organization = typeof body?.organization === "string" ? body.organization.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!organizationNamePattern.test(organization) || !repositoryNamePattern.test(name) || /\.git$/i.test(name)) {
    return NextResponse.json({ error: "Organization名とリポジトリ名を確認してください。" }, { status: 400 });
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "チームが見つかりません。" }, { status: 404 });
  }

  const githubRepo = `${organization}/${name}`;
  let repositoryCreated = false;

  try {
    const currentTeam = await getTeamById(id);
    if (!currentTeam || currentTeam.event_id !== access.event.id) {
      throw new OrganizationRepositoryError("このイベントのチームではありません。", 403);
    }
    if (currentTeam.github_repo) {
      throw new OrganizationRepositoryError("このチームにはすでにリポジトリが設定されています。", 409);
    }

    const token = await authorizeOrganizationRepositoryCreation({
      organization,
      login: access.identity.login,
      githubId: access.identity.githubId
    });

    const source = await getDataSource();
    const team = await source.transaction(async (manager) => {
      // Recheck with a row lock so a parallel create or edit cannot replace the link.
      const [lockedTeam] = await manager.query<Team[]>(
        "SELECT * FROM teams WHERE id = $1 AND event_id = $2 FOR UPDATE",
        [id, access.event.id]
      );
      if (!lockedTeam || lockedTeam.github_repo) {
        throw new OrganizationRepositoryError("チームが削除されたか、すでにリポジトリが設定されています。", 409);
      }

      const [alreadyLinked] = await manager.query<{ id: string }[]>(
        "SELECT id FROM teams WHERE event_id = $1 AND lower(github_repo) = lower($2)",
        [access.event.id, githubRepo]
      );
      if (alreadyLinked) {
        throw new OrganizationRepositoryError("このリポジトリ名は別のチームに設定されています。", 409);
      }

      // Reserve the link under the existing unique index before creating on GitHub.
      // If creation fails, the transaction rolls back the link.
      await manager.createQueryBuilder().update("teams")
        .set({ github_repo: githubRepo, github_repo_managed: true }).where("id = :id", { id }).execute();
      await createOrganizationRepository({ organization, name, token });
      repositoryCreated = true;
      return { ...lockedTeam, github_repo: githubRepo, github_repo_managed: true };
    });

    const webhook = await ensureRepoWebhookWithToken({ accessToken: token, githubRepo, requestUrl: request.url });
    await notifyEventStateChanged(access.event.id);
    return NextResponse.json({ team, webhook }, { status: 201 });
  } catch (error) {
    if (error instanceof OrganizationRepositoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "このリポジトリ名は別のチームに設定されています。" }, { status: 409 });
    }
    if (repositoryCreated) {
      return NextResponse.json({
        error: `GitHubに ${githubRepo} を作成しました。チーム一覧を更新し、未設定の場合はチームの編集からこのリポジトリを登録してください。`
      }, { status: 503 });
    }
    return NextResponse.json({ error: "作成処理を完了できませんでした。時間をおいて再試行してください。" }, { status: 503 });
  }
}
