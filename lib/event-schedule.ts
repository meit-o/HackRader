import type { HackEvent } from "@/lib/types";

type EventScheduleInput = {
  startsAt?: string | null;
  endsAt?: string | null;
};

/** 入力された開催期間をUTCのISO形式にそろえ、逆転した期間を防ぐ。 */
export function normalizeEventSchedule(input: EventScheduleInput) {
  const startsAt = input.startsAt?.trim();
  const endsAt = input.endsAt?.trim();
  if (!startsAt || !endsAt) {
    throw new Error("ハッカソンの開始日時と終了日時を設定してください。");
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("開始日時または終了日時の形式が正しくありません。");
  }
  if (end.getTime() <= start.getTime()) {
    throw new Error("終了日時は開始日時より後にしてください。");
  }

  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

/** 未設定や壊れた日時は、削除可能な終了済みとして扱わない。 */
export function hasEventEnded(event: Pick<HackEvent, "ends_at">, now = Date.now()) {
  if (!event.ends_at) return false;
  const endAt = Date.parse(event.ends_at);
  return Number.isFinite(endAt) && endAt <= now;
}
