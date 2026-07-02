import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getDb } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const query = (new URL(req.url).searchParams.get("q") || "").trim();
  if (query.length < 2) return NextResponse.json({ results: [] });

  try {
    const sql = getDb();
    const pattern = `%${query}%`;
    const [customers, orders] = await Promise.all([
      sql`
        SELECT id, customer_id AS code, name AS title, phone, email, address
        FROM customers
        WHERE is_deleted = false
          AND (name ILIKE ${pattern} OR phone ILIKE ${pattern} OR email ILIKE ${pattern} OR address ILIKE ${pattern} OR customer_id ILIKE ${pattern})
        ORDER BY created_at DESC
        LIMIT 6
      `,
      sql`
        SELECT o.id, o.order_number AS code, o.service_type, o.status, o.total_amount, c.name AS customer_name
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        WHERE o.is_deleted = false
          AND (o.order_number ILIKE ${pattern} OR c.name ILIKE ${pattern} OR c.phone ILIKE ${pattern})
        ORDER BY o.created_at DESC
        LIMIT 6
      `,
    ]);

    return NextResponse.json({
      results: [
        ...customers.map((customer: any) => ({
          id: customer.id,
          type: "Customer",
          title: customer.title,
          detail: [customer.code, customer.phone, customer.email].filter(Boolean).join(" · "),
          href: `/customers/${customer.id}`,
        })),
        ...orders.map((order: any) => ({
          id: order.id,
          type: "Order",
          title: order.code,
          detail: [order.customer_name, order.service_type, order.status].filter(Boolean).join(" · "),
          href: `/orders/${order.id}`,
        })),
      ],
    });
  } catch (err) {
    console.error("[Search API]", err);
    return NextResponse.json({ results: [] });
  }
}
