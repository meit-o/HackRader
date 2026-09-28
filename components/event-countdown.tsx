"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import type { HackEvent } from "@/lib/types";

function remainingLabel(milliseconds: number) {
  if (milliseconds <= 0) return "終了しました";
  const day = 24 * 60 * 60 * 1000;
  if (milliseconds >= day) return `残り ${Math.ceil(milliseconds / day)}日`;

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `残り ${hours}時間 ${String(minutes).padStart(2, "0")}分 ${String(seconds).padStart(2, "0")}秒`;
}

/** イベント終了までを、24時間未満だけ秒単位で見せる。 */
export function EventCountdown({ event }: { event: HackEvent | null }) {
  const [now, setNow] = useState(() => Date.now());
  const endAt = event?.ends_at ? Date.parse(event.ends_at) : Number.NaN;

  useEffect(() => {
    if (!Number.isFinite(endAt) || endAt <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endAt]);

  const remaining = useMemo(() => endAt - now, [endAt, now]);
  const isUrgent = Number.isFinite(remaining) && remaining > 0 && remaining < 24 * 60 * 60 * 1000;

  if (!event?.ends_at || !Number.isFinite(endAt)) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-sun/30 bg-sun/5 px-3.5 py-3 text-sm text-ink2 shadow-soft">
        <Clock3 className="size-4 shrink-0 text-sun" />
        開催期間がまだ設定されていません。
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3.5 py-3 text-sm font-bold shadow-soft ${
        isUrgent
          ? "border-hot/35 bg-hot/5 text-hot"
          : remaining <= 0
            ? "border-line bg-paper text-muted"
            : "border-pulse/25 bg-pulse/5 text-ink"
      }`}
      aria-live="polite"
    >
      <Clock3 className="size-4 shrink-0" />
      <span>{remainingLabel(remaining)}</span>
    </div>
  );
}
