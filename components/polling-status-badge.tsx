import { RefreshCw } from "lucide-react";

export function PollingStatusBadge({ isRefreshing }: { isRefreshing: boolean }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="fixed right-3 top-[4.5rem] z-40 inline-flex items-center gap-1.5 rounded-full border border-field/50 bg-paper/95 px-2.5 py-1 text-xs font-medium text-field shadow-soft backdrop-blur sm:right-6"
    >
      <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
      <span>定期更新中</span>
    </span>
  );
}
