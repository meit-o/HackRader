import { upgradeWebSocket } from "@vercel/functions";
import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/lib/session";
import { isRealtimeConfigured, subscribeToEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel closes WebSocket connections when the function reaches maxDuration.
export const maxDuration = 300;

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let sameOrigin = false;
  try {
    sameOrigin = Boolean(origin && host && new URL(origin).host === host);
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) {
    return NextResponse.json({ error: "Invalid WebSocket origin." }, { status: 403 });
  }

  const identity = await getCurrentIdentity();
  if (!identity || !identity.eventId) {
    return NextResponse.json({ error: "イベントに参加してから接続してください。" }, { status: 401 });
  }
  if (!isRealtimeConfigured()) {
    return NextResponse.json({ error: "Realtime notifications are not configured." }, { status: 503 });
  }

  const eventId = identity.eventId;
  return upgradeWebSocket(async (socket) => {
    const subscription = subscribeToEvent(eventId);
    let closed = false;
    const heartbeat = setInterval(() => {
      if (socket.readyState === socket.OPEN) socket.ping();
    }, 30000);
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      void subscription.unsubscribe();
    };

    subscription.on("subscribe", () => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify({ type: "ready" }));
      }
    });
    subscription.on("message", () => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify({ type: "state_changed" }));
      }
    });
    subscription.on("error", (error) => {
      console.error("Realtime subscription failed.", error);
      socket.close(1011, "Realtime subscription failed");
    });
    socket.on("close", close);
    socket.on("error", close);

    await new Promise<void>((resolve) => socket.once("close", resolve));
    close();
  }, { maxPayload: 1024 });
}
