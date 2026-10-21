import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const source = await getDataSource();
    await source.query("SELECT 1");
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
