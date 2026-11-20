import { sign } from "node:crypto";

export const organizationNamePattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
export const repositoryNamePattern = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/;

export class OrganizationRepositoryError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function isOrganizationRepositoryCreationConfigured() {
  return Boolean(process.env.GITHUB_APP_ID?.trim() && process.env.GITHUB_APP_PRIVATE_KEY?.trim());
}

export function getGitHubAppInstallUrl() {
  const slug = process.env.GITHUB_APP_SLUG?.trim();
  return slug && organizationNamePattern.test(slug)
    ? `https://github.com/apps/${slug}/installations/new`
    : null;
}

function createAppJwt() {
  if (!isOrganizationRepositoryCreationConfigured()) {
    throw new OrganizationRepositoryError("Organization連携はまだ設定されていません。", 503);
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: process.env.GITHUB_APP_ID?.trim(),
    iat: now - 60,
    exp: now + 540
  })).toString("base64url");
  const input = `${header}.${claims}`;

  try {
    const key = process.env.GITHUB_APP_PRIVATE_KEY!.trim().replace(/\\n/g, "\n");
    const signature = sign("RSA-SHA256", Buffer.from(input), key).toString("base64url");
    return `${input}.${signature}`;
  } catch {
    throw new OrganizationRepositoryError("GitHub Appの秘密鍵を確認してください。", 503);
  }
}

async function githubRequest(path: string, token: string, body?: object) {
  try {
    return await fetch(`https://api.github.com${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "HackRadar",
        "x-github-api-version": "2026-03-10"
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000)
    });
  } catch {
    const message = body && path.startsWith("/orgs/")
      ? "GitHubから作成結果を確認できませんでした。もう一度作成する前に、Organizationのリポジトリ一覧を確認してください。"
      : "GitHubに接続できませんでした。時間をおいて再試行してください。";
    throw new OrganizationRepositoryError(message, 502);
  }
}

/** Return only installations whose Organization is owned by this GitHub user. */
export async function listOrganizationRepositoryTargets(input: { login: string; githubId: number }) {
  const appJwt = createAppJwt();
  const appResponse = await githubRequest("/app", appJwt);
  if (!appResponse.ok) {
    throw new OrganizationRepositoryError("GitHub Appの設定を確認できませんでした。", 502);
  }
  const app = await appResponse.json() as { slug?: string };
  const installUrl = app.slug && /^[a-z0-9-]+$/i.test(app.slug)
    ? `https://github.com/apps/${app.slug}/installations/new`
    : null;
  const organizations = new Set<string>();

  for (let page = 1; ; page += 1) {
    const response = await githubRequest(`/app/installations?per_page=100&page=${page}`, appJwt);
    if (!response.ok) {
      throw new OrganizationRepositoryError("連携済みOrganizationを取得できませんでした。", 502);
    }
    const installations = await response.json() as Array<{
      account?: { login?: string };
      target_type?: string;
      suspended_at?: string | null;
    }>;
    for (const installation of installations) {
      const organization = installation.account?.login;
      if (!organization || installation.target_type !== "Organization" || installation.suspended_at) continue;
      try {
        await authorizeOrganizationRepositoryCreation({ ...input, organization });
        organizations.add(organization);
      } catch (error) {
        // Other installations are private to their owners. Upstream outages must
        // remain visible so an outage cannot look like an empty installation list.
        if (error instanceof OrganizationRepositoryError && (error.status === 403 || error.status === 404)) continue;
        throw error;
      }
    }
    if (installations.length < 100) break;
  }

  return { organizations: [...organizations].sort(), installUrl };
}

export async function authorizeOrganizationRepositoryCreation(input: {
  organization: string;
  login: string;
  githubId: number;
}) {
  const appJwt = createAppJwt();
  const orgPath = `/orgs/${encodeURIComponent(input.organization)}`;
  const installationResponse = await githubRequest(`${orgPath}/installation`, appJwt);
  if (installationResponse.status === 404) {
    throw new OrganizationRepositoryError(`「${input.organization}」へのGitHub Appのインストールを確認できませんでした。連携済みOrganizationを選ぶか、対象OrganizationにGitHub Appをインストールして一覧を再読み込みしてください。`, 404);
  }
  if (!installationResponse.ok) {
    throw new OrganizationRepositoryError("GitHub Appのインストール情報を取得できませんでした。", 502);
  }

  const installation = await installationResponse.json() as {
    id: number;
    account?: { login?: string };
    target_type?: string;
    suspended_at?: string | null;
  };
  if (!Number.isSafeInteger(installation.id) || installation.id <= 0 ||
      installation.target_type !== "Organization" || installation.suspended_at ||
      installation.account?.login?.toLowerCase() !== input.organization.toLowerCase()) {
    throw new OrganizationRepositoryError("対象OrganizationでGitHub Appが有効か確認してください。", 403);
  }

  const tokenResponse = await githubRequest(`/app/installations/${installation.id}/access_tokens`, appJwt, {});
  if (!tokenResponse.ok) {
    throw new OrganizationRepositoryError("GitHub AppのMembers・Repository creation・Webhooks権限が承認済みか確認してください。", 502);
  }
  const { token } = await tokenResponse.json() as { token?: string };
  if (!token) throw new OrganizationRepositoryError("GitHub Appの認証に失敗しました。", 502);

  const membershipResponse = await githubRequest(`${orgPath}/memberships/${encodeURIComponent(input.login)}`, token);
  if (membershipResponse.status === 404) {
    throw new OrganizationRepositoryError("このOrganizationのオーナーとしてログインしてください。", 403);
  }
  if (!membershipResponse.ok) {
    throw new OrganizationRepositoryError("Organizationのオーナー権限を確認できませんでした。", 502);
  }
  const membership = await membershipResponse.json() as { state?: string; role?: string; user?: { id?: number } };
  if (membership.state !== "active" || membership.role !== "admin" || membership.user?.id !== input.githubId) {
    throw new OrganizationRepositoryError("このOrganizationのオーナーとしてログインしてください。", 403);
  }

  return token;
}

export async function createOrganizationRepository(input: {
  organization: string;
  name: string;
  token: string;
}) {
  const response = await githubRequest(`/orgs/${encodeURIComponent(input.organization)}/repos`, input.token, {
    name: input.name,
    private: true,
    auto_init: true
  });
  if (response.status === 422) {
    throw new OrganizationRepositoryError("GitHubがこの名前での作成を受け付けませんでした。同名のリポジトリがないか確認してください。", 409);
  }
  if (response.status === 403) {
    throw new OrganizationRepositoryError("GitHubで作成が許可されませんでした。Organizationの設定とGitHub Appの権限を確認してください。", 403);
  }
  if (response.status !== 201) {
    throw new OrganizationRepositoryError("リポジトリを作成できませんでした。再試行する前にGitHubのリポジトリ一覧を確認してください。", 502);
  }
}
