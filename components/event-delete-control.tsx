"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { hasEventEnded } from "@/lib/event-schedule";
import type { HackEvent } from "@/lib/types";

/** 終了後だけ解錠する、運営用のイベント削除操作。 */
export function EventDeleteControl({ event }: { event: HackEvent }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const isUnlocked = hasEventEnded(event, now);

  useEffect(() => {
    if (!event.ends_at || isUnlocked) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [event.ends_at, isUnlocked]);

  async function removeEvent() {
    setIsBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/event", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmCode })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "削除できませんでした。");

      window.localStorage.removeItem("hackverse-session");
      router.replace("/");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "削除できませんでした。");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-hot/25 bg-hot/5 p-3.5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">イベントの削除</p>
          <p className="mt-0.5 text-xs leading-5 text-muted">
            {isUnlocked
              ? "イベントは終了しました。招待コードの確認後に削除できます。"
              : event.ends_at
                ? "終了時刻になるまで削除はロックされています。"
                : "終了日時を設定すると、終了時に削除できるようになります。"}
          </p>
        </div>
        <button
          type="button"
          disabled={!isUnlocked || isBusy}
          onClick={() => setOpen(true)}
          className="flex h-10 items-center gap-2 rounded-xl bg-hot px-3.5 text-sm font-bold text-white shadow-btn transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Trash2 className="size-4" />
          このイベントを削除
        </button>
      </div>

      {open && isUnlocked && (
        <div className="mt-3 border-t border-hot/20 pt-3">
          <p className="text-xs leading-5 text-ink2">
            チーム、活動履歴、質問、連絡、招待コードをすべて削除します。確認のため招待コードを入力してください。
          </p>
          <input
            value={confirmCode}
            onChange={(input) => setConfirmCode(input.target.value.toUpperCase())}
            className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3 font-mono text-sm tracking-wide text-ink outline-none focus:border-hot"
            placeholder="0000-0000"
            autoComplete="off"
            aria-label="確認のための招待コード"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmCode("");
                setError("");
              }}
              disabled={isBusy}
              className="h-10 flex-1 rounded-xl border border-line bg-surface text-sm font-medium text-ink2 disabled:opacity-50"
            >
              やめる
            </button>
            <button
              type="button"
              onClick={() => void removeEvent()}
              disabled={isBusy || confirmCode.trim().toUpperCase() !== event.join_code.toUpperCase()}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-hot text-sm font-bold text-white shadow-btn disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isBusy && <LoaderCircle className="size-4 animate-spin" />}
              削除する
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-medium text-hot">{error}</p>}
        </div>
      )}
    </section>
  );
}
