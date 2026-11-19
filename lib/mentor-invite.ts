import { createHmac, timingSafeEqual } from "node:crypto";
import { isDemoModeEnabled } from "@/lib/env";
import type { HackEvent } from "@/lib/types";

function inviteSecret() {
  return process.env.AUTH_SECRET || process.env.GITHUB_CLIENT_SECRET;
}

export function usesDemoMentorInvites() {
  return !inviteSecret() && isDemoModeEnabled();
}

export function createMentorInviteCode(event: Pick<HackEvent, "id" | "join_code">): string {
  if (usesDemoMentorInvites()) return event.join_code;
  const secret = inviteSecret();
  if (!secret) throw new Error("メンター招待の認証設定が必要です。");
  const signature = createHmac("sha256", secret)
    .update(`mentor:${event.id}:${event.join_code}`).digest("hex");
  return `MENTOR-${event.id}.${signature}`.toUpperCase();
}

export function mentorInviteEventId(code: string): string | null {
  const match = /^MENTOR-([0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12})\.[0-9A-F]{64}$/i.exec(code);
  return match?.[1].toLowerCase() ?? null;
}

export function verifyMentorInvite(code: string, event: Pick<HackEvent, "id" | "join_code">): boolean {
  const expected = Buffer.from(createMentorInviteCode(event));
  const actual = Buffer.from(code.trim().toUpperCase());
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
