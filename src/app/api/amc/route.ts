import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getDb } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  try {
    const sql = getDb();
    const [orders, statsRows] = await Promise.all([
      sql`SELECT o.id, o.order_number, o.status, o.subtotal, o.discount, o.tax_amount, o.total_amount, o.scheduled_date, o.scheduled_time, o.completed_at, o.notes, o.assigned_to, o.created_at, c.id AS customer_id, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.address AS customer_address FROM orders o LEFT JOIN customers c ON c.id = o.customer_id AND c.is_deleted = false WHERE o.service_type = 'COMBINED' AND o.is_deleted = false ORDER BY o.created_at DESC`,
      sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed, COUNT(*) FILTER (WHERE status IN ('PENDING','SCHEDULED','IN_PROGRESS')) AS pending, COALESCE(SUM(total_amount) FILTER (WHERE status <> 'CANCELLED'), 0) AS contract_value, COALESCE(SUM(total_amount) FILTER (WHERE status = 'COMPLETED'), 0) AS collected FROM orders WHERE service_type = 'COMBINED' AND is_deleted = false`,
    ]);
    const contractValue = Number(statsRows[0].contract_value);
    const collected = Number(statsRows[0].collected);
    return NextResponse.json({ orders, stats: { total: Number(statsRows[0].total), completed: Number(statsRows[0].completed), pending: Number(statsRows[0].pending), contract_value: contractValue, collected, pending_amount: Math.max(0, contractValue - collected), revenue: collected, active_contracts: Number(statsRows[0].pending), expiring_soon: 0 } });
  } catch (err) {
    console.error("[AMC API]", err);
    return NextResponse.json({ detail: "Failed to load AMC contracts" }, { status: 500 });
  }
}
