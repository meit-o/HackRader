import { Radio } from "lucide-react";

export function RealtimeStatusBadge({
  isConnected,
  isRefreshing
}: {
  isConnected: boolean;
  isRefreshing: boolean;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="fixed right-3 top-[4.5rem] z-40 inline-flex items-center gap-1.5 rounded-full border border-field/50 bg-paper/95 px-2.5 py-1 text-xs font-medium text-field shadow-soft backdrop-blur sm:right-6"
    >
      <Radio className={`size-3.5 ${isRefreshing ? "animate-pulse" : ""}`} />
      <span>{isConnected ? (isRefreshing ? "更新中" : "リアルタイム接続中") : "再接続中"}</span>
    </span>
  );
}
