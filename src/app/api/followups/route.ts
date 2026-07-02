import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getDb } from "@/lib/server-auth";
import {
  formatSchedule,
  getJobReminderMessage,
  getPaymentReminderMessage,
  getServiceLabel,
  getWhatsAppUrl,
} from "@/lib/business";

type FollowUpType = "payment" | "job" | "quotation" | "amc" | "review";

function makeItem(input: {
  id: string;
  type: FollowUpType;
  priority: number;
  title: string;
  customer_name: string;
  customer_phone: string | null;
  order_number: string;
  service_type: string;
  amount?: number;
  due_label?: string;
  message: string;
  href: string;
}) {
  return {
    ...input,
    whatsapp_url: getWhatsAppUrl(input.customer_phone, input.message),
    has_phone: Boolean(input.customer_phone),
  };
}

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const sql = getDb();
    const [paymentRows, jobRows, quotationRows, amcRows, reviewRows] = await Promise.all([
      sql`
        SELECT o.id, o.order_number, o.service_type, o.total_amount, c.name AS customer_name, c.phone AS customer_phone
        FROM orders o
        JOIN customers c ON c.id = o.customer_id AND c.is_deleted = false
        WHERE o.is_deleted = false
          AND o.total_amount > 0
          AND o.status NOT IN ('COMPLETED','CANCELLED')
        ORDER BY o.created_at ASC
        LIMIT 8
      `,
      sql`
        SELECT o.id, o.order_number, o.service_type, o.scheduled_date::text AS scheduled_date, o.scheduled_time,
               c.name AS customer_name, c.phone AS customer_phone
        FROM orders o
        JOIN customers c ON c.id = o.customer_id AND c.is_deleted = false
        WHERE o.is_deleted = false
          AND o.status IN ('PENDING','SCHEDULED','IN_PROGRESS')
          AND o.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 day'
        ORDER BY o.scheduled_date ASC, o.scheduled_time ASC NULLS LAST
        LIMIT 8
      `,
      sql`
        SELECT o.id, o.order_number, o.service_type, o.total_amount, o.created_at::date AS created_date,
               c.name AS customer_name, c.phone AS customer_phone
        FROM orders o
        JOIN customers c ON c.id = o.customer_id AND c.is_deleted = false
        WHERE o.is_deleted = false
          AND o.status = 'PENDING'
        ORDER BY o.created_at ASC
        LIMIT 6
      `,
      sql`
        SELECT o.id, o.order_number, o.service_type, o.scheduled_date::text AS scheduled_date, o.total_amount,
               c.name AS customer_name, c.phone AS customer_phone
        FROM orders o
        JOIN customers c ON c.id = o.customer_id AND c.is_deleted = false
        WHERE o.is_deleted = false
          AND o.service_type = 'COMBINED'
          AND o.status IN ('PENDING','SCHEDULED','IN_PROGRESS')
          AND o.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        ORDER BY o.scheduled_date ASC NULLS LAST
        LIMIT 6
      `,
      sql`
        SELECT o.id, o.order_number, o.service_type, o.completed_at::date AS completed_date,
               c.name AS customer_name, c.phone AS customer_phone
        FROM orders o
        JOIN customers c ON c.id = o.customer_id AND c.is_deleted = false
        WHERE o.is_deleted = false
          AND o.status = 'COMPLETED'
          AND o.completed_at >= NOW() - INTERVAL '7 days'
        ORDER BY o.completed_at DESC
        LIMIT 6
      `,
    ]);

    const followups = [
      ...paymentRows.map((row: any) => makeItem({
        id: `payment-${row.id}`,
        type: "payment",
        priority: 1,
        title: "Payment reminder",
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        order_number: row.order_number,
        service_type: row.service_type,
        amount: Number(row.total_amount),
        due_label: `Due ${Number(row.total_amount).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}`,
        href: `/orders/${row.id}`,
        message: getPaymentReminderMessage({
          customerName: row.customer_name,
          orderNumber: row.order_number,
          amount: Number(row.total_amount),
          serviceType: row.service_type,
        }),
      })),
      ...jobRows.map((row: any) => makeItem({
        id: `job-${row.id}`,
        type: "job",
        priority: 2,
        title: "Job confirmation",
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        order_number: row.order_number,
        service_type: row.service_type,
        due_label: formatSchedule(row.scheduled_date, row.scheduled_time),
        href: `/orders/${row.id}`,
        message: getJobReminderMessage({
          customerName: row.customer_name,
          orderNumber: row.order_number,
          serviceType: row.service_type,
          scheduledDate: row.scheduled_date,
          scheduledTime: row.scheduled_time,
        }),
      })),
      ...quotationRows.map((row: any) => makeItem({
        id: `quotation-${row.id}`,
        type: "quotation",
        priority: 3,
        title: "Quotation follow-up",
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        order_number: row.order_number,
        service_type: row.service_type,
        amount: Number(row.total_amount),
        due_label: `${getServiceLabel(row.service_type)} quotation`,
        href: `/orders/${row.id}`,
        message: `Hello ${row.customer_name}, this is PrimeX Services. We are following up on your ${getServiceLabel(row.service_type)} quotation ${row.order_number}. Please let us know if you would like to proceed.`,
      })),
      ...amcRows.map((row: any) => makeItem({
        id: `amc-${row.id}`,
        type: "amc",
        priority: 4,
        title: "AMC renewal reminder",
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        order_number: row.order_number,
        service_type: row.service_type,
        amount: Number(row.total_amount),
        due_label: formatSchedule(row.scheduled_date),
        href: `/orders/${row.id}`,
        message: `Hello ${row.customer_name}, this is PrimeX Services. Your AMC service ${row.order_number} is coming up on ${formatSchedule(row.scheduled_date)}. Please confirm renewal or service availability.`,
      })),
      ...reviewRows.map((row: any) => makeItem({
        id: `review-${row.id}`,
        type: "review",
        priority: 5,
        title: "Review request",
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        order_number: row.order_number,
        service_type: row.service_type,
        due_label: "Completed recently",
        href: `/orders/${row.id}`,
        message: `Hello ${row.customer_name}, thank you for choosing PrimeX Services for ${getServiceLabel(row.service_type)}. If you are happy with the work, please share a quick review or referral.`,
      })),
    ].sort((a, b) => a.priority - b.priority);

    return NextResponse.json({
      followups: followups.slice(0, 15),
      counts: followups.reduce((acc: Record<string, number>, item) => {
        acc[item.type] = (acc[item.type] ?? 0) + 1;
        return acc;
      }, {}),
    });
  } catch (err) {
    console.error("[Followups API]", err);
    return NextResponse.json({ followups: [], counts: {}, warning: "Follow-ups are temporarily unavailable." });
  }
}
