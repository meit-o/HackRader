import { Redis } from "@upstash/redis";

const EVENT_CHANNEL_PREFIX = "hackradar:event:";

export function isRealtimeConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function getRedis(): Redis {
  if (!isRealtimeConfigured()) {
    throw new Error("Realtime requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
  }
  return Redis.fromEnv();
}

export function eventRealtimeChannel(eventId: string): string {
  return `${EVENT_CHANNEL_PREFIX}${eventId}`;
}

/** Publish only after the database mutation has completed. Clients reload the scoped snapshot. */
export async function publishEventStateChanged(eventId: string): Promise<void> {
  await getRedis().publish(
    eventRealtimeChannel(eventId),
    JSON.stringify({ type: "state_changed", eventId })
  );
}

export async function notifyEventStateChanged(eventId?: string | null): Promise<void> {
  if (!eventId) return;
  try {
    await publishEventStateChanged(eventId);
  } catch (error) {
    // The database write has already committed. Keep its HTTP result successful;
    // clients resynchronize on reconnect and the failure remains visible in logs.
    console.error("Could not publish realtime state notification.", error);
  }
}

export function subscribeToEvent(eventId: string) {
  return getRedis().subscribe<string>(eventRealtimeChannel(eventId));
}
