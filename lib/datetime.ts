/**
 * 画面に出す日時の書式をここに集める。
 *
 * 時刻だけだと「今日の話なのか昨日の話なのか」が分からず、
 * 前日から動いているハッカソンでは読み違えるため、月日を必ず添える。
 */

const displayFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23"
});

// Server Components and hydration must produce the same text, regardless of
// the server's or browser's local timezone.
function dateTimeParts(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(displayFormatter.formatToParts(date).map(({ type, value: part }) => [type, part]));
}

/** 日本時間。例: 8月11日 14:30 */
export function formatDateTime(value: string | Date): string {
  const parts = dateTimeParts(value);
  return parts ? `${parts.month}月${parts.day}日 ${parts.hour.padStart(2, "0")}:${parts.minute}` : "";
}

/** 例: 8/11 14:30（横幅が狭い一覧向け） */
export function formatShortDateTime(value: string | Date): string {
  const parts = dateTimeParts(value);
  return parts ? `${parts.month}/${parts.day} ${parts.hour.padStart(2, "0")}:${parts.minute}` : "";
}
