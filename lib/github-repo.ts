/**
 * GitHub のリポジトリ指定を、保存用の `owner/repository` 形式へそろえる。
 * 一覧からの選択値と、GitHub URL の貼り付けを同じ扱いにするために使う。
 */
export function normalizeGitHubRepo(input: string): string {
  const value = input.trim();

  if (/^[^/\s]+\/[^/\s]+$/.test(value)) {
    return value;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("GitHubのリポジトリURLまたは owner/repository を入力してください。");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "github.com" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  ) {
    throw new Error("https://github.com/owner/repository の形式で入力してください。");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new Error("https://github.com/owner/repository の形式で入力してください。");
  }

  const [owner, repositoryWithExtension] = parts;
  const repository = repositoryWithExtension.replace(/\.git$/i, "");
  if (!owner || !repository || /\s/.test(owner) || /\s/.test(repository)) {
    throw new Error("https://github.com/owner/repository の形式で入力してください。");
  }

  return `${owner}/${repository}`;
}
