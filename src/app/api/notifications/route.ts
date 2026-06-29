import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getDb } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  try {
    const sql = getDb();
    const notifications = await sql`
      SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50
    `;
    const unread_count = notifications.filter((n: any) => !n.is_read).length;
    return NextResponse.json({ notifications, unread_count });
  } catch (err) {
    console.error("[Notifications API]", err);
    return NextResponse.json({ detail: "Failed to load notifications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  try {
    const sql = getDb();
    const body = await req.json();
    if (body.id) {
      await sql`UPDATE notifications SET is_read = true WHERE id = ${body.id}::uuid`;
    } else if (body.markAllRead) {
      await sql`UPDATE notifications SET is_read = true WHERE is_read = false`;
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Notifications POST]", err);
    return NextResponse.json({ detail: "Failed to update notification" }, { status: 500 });
  }
}
