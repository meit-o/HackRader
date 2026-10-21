import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/lib/session";
import { getDataSource } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity?.eventId || identity.role === "judge") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const source = await getDataSource();
  const rows = await source.createQueryBuilder()
    .select("message.attachment_data", "attachment_data")
    .addSelect("message.attachment_mime_type", "attachment_mime_type")
    .from("direct_messages", "message")
    .where("message.id = :id", { id })
    .andWhere("message.event_id = :eventId", { eventId: identity.eventId })
    .andWhere("(lower(message.sender_login) = lower(:login) OR lower(message.recipient_login) = lower(:login))", { login: identity.login })
    .getRawOne<{ attachment_data: Buffer | null; attachment_mime_type: string | null }>();

  if (!rows?.attachment_data || !rows.attachment_mime_type) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  return new Response(new Uint8Array(rows.attachment_data), {
    headers: {
      "Content-Type": rows.attachment_mime_type,
      "Content-Length": String(rows.attachment_data.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
