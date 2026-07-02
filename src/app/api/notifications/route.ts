import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAuthPayload, getDb } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const authResult = requireAuthPayload(req);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.payload.sub;
  try {
    const sql = getDb();
    const notifications = await sql`
      SELECT id, title, message, type, is_read, entity_type, entity_id, created_at
      FROM notifications
      WHERE user_id = ${userId}::uuid OR user_id IS NULL
      ORDER BY created_at DESC LIMIT 50
    `;
    const [todayJobs, tomorrowJobs, needsConfirmation, unpaidJobs, amcRenewals] = await Promise.all([
      sql`
        SELECT o.id, o.order_number, o.service_type, o.scheduled_time, c.name AS customer_name
        FROM orders o JOIN customers c ON c.id = o.customer_id
        WHERE o.is_deleted=false AND o.status NOT IN ('COMPLETED','CANCELLED') AND o.scheduled_date = CURRENT_DATE
        ORDER BY o.scheduled_time ASC NULLS LAST LIMIT 10
      `.catch(() => []),
      sql`
        SELECT o.id, o.order_number, o.service_type, o.scheduled_time, c.name AS customer_name
        FROM orders o JOIN customers c ON c.id = o.customer_id
        WHERE o.is_deleted=false AND o.status NOT IN ('COMPLETED','CANCELLED') AND o.scheduled_date = CURRENT_DATE + INTERVAL '1 day'
        ORDER BY o.scheduled_time ASC NULLS LAST LIMIT 10
      `.catch(() => []),
      sql`
        SELECT o.id, o.order_number, o.service_type, o.scheduled_date::text AS scheduled_date, o.scheduled_time, c.name AS customer_name
        FROM orders o JOIN customers c ON c.id = o.customer_id
        WHERE o.is_deleted=false AND o.status NOT IN ('COMPLETED','CANCELLED') AND o.scheduled_date IS NOT NULL
          AND (o.scheduled_date < CURRENT_DATE OR (o.scheduled_date = CURRENT_DATE AND COALESCE(o.scheduled_time, '23:59'::time) < CURRENT_TIME))
        ORDER BY o.scheduled_date ASC, o.scheduled_time ASC NULLS LAST LIMIT 10
      `.catch(() => []),
      sql`
        SELECT o.id, o.order_number, o.total_amount, c.name AS customer_name
        FROM orders o JOIN customers c ON c.id = o.customer_id
        WHERE o.is_deleted=false AND o.status NOT IN ('COMPLETED','CANCELLED') AND o.total_amount > 0
        ORDER BY o.created_at ASC LIMIT 10
      `.catch(() => []),
      sql`
        SELECT o.id, o.order_number, c.name AS customer_name, (COALESCE(o.scheduled_date, o.created_at::date) + INTERVAL '1 year')::date AS renewal_date
        FROM orders o JOIN customers c ON c.id = o.customer_id
        WHERE o.is_deleted=false AND o.service_type='COMBINED'
          AND (COALESCE(o.scheduled_date, o.created_at::date) + INTERVAL '1 year')::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        ORDER BY renewal_date ASC LIMIT 10
      `.catch(() => []),
    ]);
    const derived = [
      ...todayJobs.map((job: any) => ({
        id: `today-${job.id}`,
        title: "Job scheduled today",
        message: `${job.order_number} for ${job.customer_name}${job.scheduled_time ? ` at ${job.scheduled_time}` : ""}`,
        type: "ORDER_ASSIGNED",
        is_read: false,
        entity_type: "order",
        entity_id: job.id,
        action_url: `/orders/${job.id}`,
        created_at: new Date().toISOString(),
      })),
      ...tomorrowJobs.map((job: any) => ({
        id: `tomorrow-${job.id}`,
        title: "Job scheduled tomorrow",
        message: `${job.order_number} for ${job.customer_name}${job.scheduled_time ? ` at ${job.scheduled_time}` : ""}`,
        type: "ORDER_ASSIGNED",
        is_read: false,
        entity_type: "order",
        entity_id: job.id,
        action_url: `/orders/${job.id}`,
        created_at: new Date().toISOString(),
      })),
      ...needsConfirmation.map((job: any) => ({
        id: `confirm-${job.id}`,
        title: "Job needs completion confirmation",
        message: `${job.order_number} for ${job.customer_name} has passed its scheduled time.`,
        type: "ORDER_STATUS",
        is_read: false,
        entity_type: "order",
        entity_id: job.id,
        action_url: `/orders/${job.id}`,
        created_at: new Date().toISOString(),
      })),
      ...unpaidJobs.map((job: any) => ({
        id: `payment-${job.id}`,
        title: "Payment pending",
        message: `${job.customer_name} has an unpaid invoice/order balance for ${job.order_number}.`,
        type: "PAYMENT_DUE",
        is_read: false,
        entity_type: "order",
        entity_id: job.id,
        action_url: `/payments`,
        created_at: new Date().toISOString(),
      })),
      ...amcRenewals.map((contract: any) => ({
        id: `amc-${contract.id}`,
        title: "AMC renewal due soon",
        message: `${contract.customer_name} contract ${contract.order_number} renews on ${contract.renewal_date}.`,
        type: "AMC_REMINDER",
        is_read: false,
        entity_type: "order",
        entity_id: contract.id,
        action_url: `/contracts`,
        created_at: new Date().toISOString(),
      })),
    ];
    const merged = [...derived, ...notifications];
    const unreadCount = merged.filter((n: any) => !n.is_read).length;
    return NextResponse.json({ notifications: merged, unreadCount });
  } catch (err) {
    console.error("[Notifications GET]", err);
    return NextResponse.json({ detail: "Failed to load notifications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = requireAuthPayload(req);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.payload.sub;
  try {
    const sql = getDb();
    const body = await req.json();
    if (body.id) {
      // Only mark own notifications as read
      await sql`UPDATE notifications SET is_read = true WHERE id = ${body.id}::uuid AND (user_id = ${userId}::uuid OR user_id IS NULL)`;
    } else if (body.markAllRead) {
      await sql`UPDATE notifications SET is_read = true WHERE (user_id = ${userId}::uuid OR user_id IS NULL) AND is_read = false`;
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Notifications POST]", err);
    return NextResponse.json({ detail: "Failed to update notification" }, { status: 500 });
  }
}
