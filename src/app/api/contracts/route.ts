import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getDb } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  try {
    const sql = getDb();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("per_page") || "20")));
    const search = (searchParams.get("search") || "").trim();
    const offset = (page - 1) * perPage;
    const searchPattern = `%${search}%`;
    const baseSelect = sql`
      SELECT
        o.id, o.order_number, o.service_type, o.status, o.total_amount,
        o.created_at, o.scheduled_date, o.scheduled_time, o.completed_at, o.notes,
        COALESCE(o.scheduled_date, o.created_at::date) AS start_date,
        (COALESCE(o.scheduled_date, o.created_at::date) + INTERVAL '1 year')::date AS renewal_date,
        ((COALESCE(o.scheduled_date, o.created_at::date) + INTERVAL '1 year')::date < CURRENT_DATE) AS is_expired,
        ((COALESCE(o.scheduled_date, o.created_at::date) + INTERVAL '1 year')::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') AS is_expiring_soon,
        c.name AS customer_name, c.customer_id AS customer_code,
        c.phone AS customer_phone, c.address AS customer_address
      FROM orders o
      JOIN customers c ON c.id = o.customer_id AND c.is_deleted = false
      WHERE o.service_type = 'COMBINED' AND o.is_deleted = false
        AND (${search} = '' OR o.order_number ILIKE ${searchPattern} OR c.name ILIKE ${searchPattern} OR c.phone ILIKE ${searchPattern})
      ORDER BY renewal_date ASC, o.created_at DESC
      LIMIT ${perPage} OFFSET ${offset}
    `;
    const [contracts, statsRows] = await Promise.all([
      baseSelect,
      sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status IN ('PENDING','SCHEDULED','IN_PROGRESS'))::int AS active,
          COUNT(*) FILTER (WHERE (COALESCE(scheduled_date, created_at::date) + INTERVAL '1 year')::date < CURRENT_DATE)::int AS expired,
          COALESCE(SUM(total_amount), 0) AS value
        FROM orders
        WHERE service_type = 'COMBINED' AND is_deleted = false
      `,
    ]);
    const total = Number(statsRows[0]?.total ?? 0);
    const value = Number(statsRows[0]?.value ?? 0);
    return NextResponse.json({
      items: contracts.map((item: any) => ({ ...item, total_amount: Number(item.total_amount) })),
      total,
      page,
      per_page: perPage,
      pages: Math.max(1, Math.ceil(total / perPage)),
      stats: {
        total,
        active: Number(statsRows[0]?.active ?? 0),
        expired: Number(statsRows[0]?.expired ?? 0),
        value,
        total_value: value,
      },
    });
  } catch (err) {
    console.error("[Contracts API]", err);
    return NextResponse.json({
      items: [],
      total: 0,
      page: 1,
      per_page: 20,
      pages: 1,
      stats: { total: 0, active: 0, expired: 0, value: 0, total_value: 0 },
      warning: "Contracts are temporarily unavailable.",
    });
  }
}
