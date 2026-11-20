"use client";

import Link from "next/link";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error && typeof error === "object" && "digest" in error && typeof error.digest === "string"
    ? error.digest
    : null;
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-16">
      <h1 className="text-xl font-bold text-ink">ページを読み込めませんでした</h1>
      <p role="alert" className="text-sm leading-6 text-ink2">
        通信が途切れたか、一時的にデータを取得できませんでした。
      </p>
      {digest && <p className="text-xs text-muted">確認用コード {digest}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={retry} className="rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white">
          再読み込み
        </button>
        <Link href="/" className="text-sm font-medium text-pulse underline underline-offset-2">イベント選択に戻る</Link>
      </div>
    </main>
  );
}
