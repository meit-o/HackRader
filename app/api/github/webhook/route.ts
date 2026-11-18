import { NextResponse } from "next/server";
import { parseGitHubWebhook, verifyGitHubSignature } from "@/lib/github";
import { getEventIdsForTeams, recordRepositoryActivity } from "@/lib/store";
import { notifyEventStateChanged } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "GITHUB_WEBHOOK_SECRET is not configured." },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const isValid = verifyGitHubSignature({ body, signature, secret });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const eventName = request.headers.get("x-github-event") ?? "";

  if (eventName === "ping") {
    return NextResponse.json({ ok: true, pong: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Payload could not be parsed." }, { status: 400 });
  }

  const parsedActivity = parseGitHubWebhook(eventName, payload);

  if (!parsedActivity) {
    return NextResponse.json({ ok: true, ignored: true, eventName });
  }

  try {
    const activities = await recordRepositoryActivity({
      ...parsedActivity,
      // 誰の操作かはGitHubのsenderから来る。参加者の自己申告ではない。
      githubDeliveryId: request.headers.get("x-github-delivery") ?? undefined
    });

    if (activities.length === 0) {
      // どのチームにも登録されていないリポジトリ。200で返して配信は成功扱いにする。
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "unregistered_repository",
        githubRepo: parsedActivity.githubRepo,
        message:
          "このリポジトリはどのチームにも登録されていないため、記録しませんでした。"
      });
    }

    // The activity is already durable in Postgres. Pub/Sub is a best-effort wake-up;
    // reconnecting clients reload the complete snapshot, and a Redis outage must not
    // make GitHub retry an already committed delivery.
    try {
      const eventIds = await getEventIdsForTeams(activities.map((activity) => activity.team_id));
      await Promise.all(eventIds.map((eventId) => notifyEventStateChanged(eventId)));
    } catch (error) {
      console.error("Could not look up event for realtime activity notification.", error);
    }

    return NextResponse.json({
      ok: true,
      eventName,
      activity: activities[0],
      activities,
      affectedTeams: activities.length
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Activity could not be recorded."
      },
      { status: 500 }
    );
  }
}
