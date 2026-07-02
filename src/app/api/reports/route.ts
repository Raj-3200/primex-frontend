import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getDb } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  try {
    const sql = getDb();
    const [monthly, topCustomers, serviceBreakdown, statusBreakdown, financeRows, expenseRows] =
      await Promise.all([
        sql`SELECT TO_CHAR(DATE_TRUNC('month', completed_at), 'Mon YYYY') AS month, DATE_TRUNC('month', completed_at) AS month_date, COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*)::int AS orders FROM orders WHERE status = 'COMPLETED' AND is_deleted = false AND completed_at >= NOW() - INTERVAL '12 months' GROUP BY DATE_TRUNC('month', completed_at) ORDER BY month_date ASC`,
        sql`SELECT c.id, c.name, c.name AS customer_name, c.customer_id AS customer_code, COUNT(o.id)::int AS order_count, COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'CANCELLED'), 0) AS billed_amount, COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED'), 0) AS collected_amount FROM customers c JOIN orders o ON o.customer_id = c.id AND o.is_deleted = false WHERE c.is_deleted = false GROUP BY c.id, c.name, c.customer_id ORDER BY billed_amount DESC LIMIT 8`,
        sql`SELECT service_type, COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0) AS revenue FROM orders WHERE is_deleted = false GROUP BY service_type`,
        sql`SELECT status, COUNT(*)::int AS count FROM orders WHERE is_deleted = false GROUP BY status`,
        sql`
          SELECT
            COALESCE(SUM(total_amount), 0) AS billed,
            COALESCE(SUM(total_amount) FILTER (WHERE status = 'COMPLETED'), 0) AS collected,
            COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('COMPLETED','CANCELLED')), 0) AS outstanding,
            COUNT(*)::int AS orders
          FROM orders
          WHERE is_deleted = false
        `,
        sql`SELECT COALESCE(SUM(amount), 0) AS expenses FROM expenses WHERE is_deleted = false`.catch(() => [{ expenses: 0 }]),
      ]);
    const finance = financeRows[0] ?? {};
    const expenses = Number(expenseRows[0]?.expenses ?? 0);
    const statusBreakdownData = statusBreakdown.map((r: any) => ({
      status: r.status,
      count: r.count,
    }));
    return NextResponse.json({
      monthly_revenue: monthly.map((r: any) => ({
        ...r,
        revenue: Number(r.revenue),
      })),
      top_customers: topCustomers.map((r: any) => ({
        ...r,
        billed_amount: Number(r.billed_amount),
        collected_amount: Number(r.collected_amount),
        total_revenue: Number(r.billed_amount),
      })),
      service_breakdown: serviceBreakdown.map((r: any) => ({
        service_type: r.service_type,
        count: Number(r.count),
        revenue: Number(r.revenue),
      })),
      status_breakdown: statusBreakdownData,
      finance: {
        billed: Number(finance.billed ?? 0),
        collected: Number(finance.collected ?? 0),
        outstanding: Number(finance.outstanding ?? 0),
        expenses,
        profit: Number(finance.collected ?? 0) - expenses,
        orders: Number(finance.orders ?? 0),
      },
    });
  } catch (err) {
    console.error("[Reports API]", err);
    return NextResponse.json({
      monthly_revenue: [],
      top_customers: [],
      service_breakdown: [],
      status_breakdown: [],
      finance: { billed: 0, collected: 0, outstanding: 0, expenses: 0, profit: 0, orders: 0 },
      warning: "Reports are temporarily unavailable.",
    });
  }
}
