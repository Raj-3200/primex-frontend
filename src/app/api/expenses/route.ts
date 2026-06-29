import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getDb } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  try {
    const sql = getDb();
    const [summary, monthly, byService] = await Promise.all([
      sql`SELECT COALESCE(SUM(total_amount) FILTER (WHERE status='COMPLETED'), 0) AS total_revenue, COALESCE(SUM(discount), 0) AS total_discounts, COALESCE(SUM(tax_amount), 0) AS total_tax, COUNT(*)::int AS total_orders, COUNT(*) FILTER (WHERE status='COMPLETED')::int AS completed_orders FROM orders WHERE is_deleted = false`,
      sql`SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month, DATE_TRUNC('month', created_at) AS month_date, COALESCE(SUM(total_amount) FILTER (WHERE status='COMPLETED'), 0) AS revenue, COUNT(*)::int AS orders FROM orders WHERE is_deleted = false AND created_at >= NOW() - INTERVAL '6 months' GROUP BY DATE_TRUNC('month', created_at) ORDER BY month_date ASC`,
      sql`SELECT service_type, COUNT(*)::int AS count, COALESCE(SUM(total_amount) FILTER (WHERE status='COMPLETED'), 0) AS revenue FROM orders WHERE is_deleted = false GROUP BY service_type`,
    ]);
    return NextResponse.json({ summary: { ...summary[0], total_revenue: Number(summary[0].total_revenue), total_discounts: Number(summary[0].total_discounts), total_tax: Number(summary[0].total_tax) }, monthly: monthly.map((r: any) => ({ ...r, revenue: Number(r.revenue) })), by_service: byService.map((r: any) => ({ ...r, revenue: Number(r.revenue) })) });
  } catch (err) {
    console.error("[Expenses API]", err);
    return NextResponse.json({ detail: "Failed to load expenses" }, { status: 500 });
  }
}
