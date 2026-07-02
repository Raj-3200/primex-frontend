import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireAuth, requireAuthPayload, DB_URL } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const per_page = Math.min(100, parseInt(searchParams.get("per_page") || "24"));
  const search = (searchParams.get("search") || "").trim();
  const propertyType = (searchParams.get("property_type") || "").trim() || null;
  const leadSource = (searchParams.get("lead_source") || "").trim() || null;
  const offset = (page - 1) * per_page;
  const searchFilter = search ? `%${search}%` : null;

  try {
    const sql = neon(DB_URL);
    const [rows, countRows] = await Promise.all([
      search && propertyType && leadSource ? sql`
        SELECT
          c.id,c.customer_id,c.name,c.phone,c.alternate_phone,c.email,c.address,
          c.latitude,c.longitude,c.maps_url,c.gst_number,c.property_type,
          c.lead_source,c.notes,c.created_at,c.updated_at,
          COUNT(DISTINCT o.id)::int AS total_orders,
          COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'COMPLETED')::int AS completed_jobs,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'CANCELLED'),0) AS billed_amount,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED'),0) AS paid_amount
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.is_deleted = false
        WHERE c.is_deleted = false
          AND c.property_type::text = ${propertyType}
          AND c.lead_source::text = ${leadSource}
          AND (c.name ILIKE ${searchFilter} OR c.phone ILIKE ${searchFilter} OR c.customer_id ILIKE ${searchFilter})
        GROUP BY c.id ORDER BY c.created_at DESC LIMIT ${per_page} OFFSET ${offset}
      ` : search && propertyType ? sql`
        SELECT
          c.id,c.customer_id,c.name,c.phone,c.alternate_phone,c.email,c.address,
          c.latitude,c.longitude,c.maps_url,c.gst_number,c.property_type,
          c.lead_source,c.notes,c.created_at,c.updated_at,
          COUNT(DISTINCT o.id)::int AS total_orders,
          COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'COMPLETED')::int AS completed_jobs,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'CANCELLED'),0) AS billed_amount,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED'),0) AS paid_amount
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.is_deleted = false
        WHERE c.is_deleted = false
          AND c.property_type::text = ${propertyType}
          AND (c.name ILIKE ${searchFilter} OR c.phone ILIKE ${searchFilter} OR c.customer_id ILIKE ${searchFilter})
        GROUP BY c.id ORDER BY c.created_at DESC LIMIT ${per_page} OFFSET ${offset}
      ` : search && leadSource ? sql`
        SELECT
          c.id,c.customer_id,c.name,c.phone,c.alternate_phone,c.email,c.address,
          c.latitude,c.longitude,c.maps_url,c.gst_number,c.property_type,
          c.lead_source,c.notes,c.created_at,c.updated_at,
          COUNT(DISTINCT o.id)::int AS total_orders,
          COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'COMPLETED')::int AS completed_jobs,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'CANCELLED'),0) AS billed_amount,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED'),0) AS paid_amount
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.is_deleted = false
        WHERE c.is_deleted = false
          AND c.lead_source::text = ${leadSource}
          AND (c.name ILIKE ${searchFilter} OR c.phone ILIKE ${searchFilter} OR c.customer_id ILIKE ${searchFilter})
        GROUP BY c.id ORDER BY c.created_at DESC LIMIT ${per_page} OFFSET ${offset}
      ` : search ? sql`
        SELECT
          c.id,c.customer_id,c.name,c.phone,c.alternate_phone,c.email,c.address,
          c.latitude,c.longitude,c.maps_url,c.gst_number,c.property_type,
          c.lead_source,c.notes,c.created_at,c.updated_at,
          COUNT(DISTINCT o.id)::int AS total_orders,
          COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'COMPLETED')::int AS completed_jobs,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'CANCELLED'),0) AS billed_amount,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED'),0) AS paid_amount
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.is_deleted = false
        WHERE c.is_deleted = false
          AND (c.name ILIKE ${searchFilter} OR c.phone ILIKE ${searchFilter} OR c.customer_id ILIKE ${searchFilter})
        GROUP BY c.id ORDER BY c.created_at DESC LIMIT ${per_page} OFFSET ${offset}
      ` : propertyType && leadSource ? sql`
        SELECT
          c.id,c.customer_id,c.name,c.phone,c.alternate_phone,c.email,c.address,
          c.latitude,c.longitude,c.maps_url,c.gst_number,c.property_type,
          c.lead_source,c.notes,c.created_at,c.updated_at,
          COUNT(DISTINCT o.id)::int AS total_orders,
          COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'COMPLETED')::int AS completed_jobs,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'CANCELLED'),0) AS billed_amount,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED'),0) AS paid_amount
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.is_deleted = false
        WHERE c.is_deleted = false
          AND c.property_type::text = ${propertyType}
          AND c.lead_source::text = ${leadSource}
        GROUP BY c.id ORDER BY c.created_at DESC LIMIT ${per_page} OFFSET ${offset}
      ` : propertyType ? sql`
        SELECT
          c.id,c.customer_id,c.name,c.phone,c.alternate_phone,c.email,c.address,
          c.latitude,c.longitude,c.maps_url,c.gst_number,c.property_type,
          c.lead_source,c.notes,c.created_at,c.updated_at,
          COUNT(DISTINCT o.id)::int AS total_orders,
          COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'COMPLETED')::int AS completed_jobs,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'CANCELLED'),0) AS billed_amount,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED'),0) AS paid_amount
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.is_deleted = false
        WHERE c.is_deleted = false
          AND c.property_type::text = ${propertyType}
        GROUP BY c.id ORDER BY c.created_at DESC LIMIT ${per_page} OFFSET ${offset}
      ` : leadSource ? sql`
        SELECT
          c.id,c.customer_id,c.name,c.phone,c.alternate_phone,c.email,c.address,
          c.latitude,c.longitude,c.maps_url,c.gst_number,c.property_type,
          c.lead_source,c.notes,c.created_at,c.updated_at,
          COUNT(DISTINCT o.id)::int AS total_orders,
          COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'COMPLETED')::int AS completed_jobs,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'CANCELLED'),0) AS billed_amount,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED'),0) AS paid_amount
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.is_deleted = false
        WHERE c.is_deleted = false
          AND c.lead_source::text = ${leadSource}
        GROUP BY c.id ORDER BY c.created_at DESC LIMIT ${per_page} OFFSET ${offset}
      ` : sql`
        SELECT
          c.id,c.customer_id,c.name,c.phone,c.alternate_phone,c.email,c.address,
          c.latitude,c.longitude,c.maps_url,c.gst_number,c.property_type,
          c.lead_source,c.notes,c.created_at,c.updated_at,
          COUNT(DISTINCT o.id)::int AS total_orders,
          COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'COMPLETED')::int AS completed_jobs,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'CANCELLED'),0) AS billed_amount,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'COMPLETED'),0) AS paid_amount
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.is_deleted = false
        WHERE c.is_deleted = false
        GROUP BY c.id ORDER BY c.created_at DESC LIMIT ${per_page} OFFSET ${offset}
      `,
      // Count query — same filter branches
      search && propertyType && leadSource ? sql`
        SELECT COUNT(DISTINCT c.id)::int AS total FROM customers c
        WHERE c.is_deleted = false AND c.property_type::text = ${propertyType}
          AND c.lead_source::text = ${leadSource}
          AND (c.name ILIKE ${searchFilter} OR c.phone ILIKE ${searchFilter} OR c.customer_id ILIKE ${searchFilter})
      ` : search && propertyType ? sql`
        SELECT COUNT(DISTINCT c.id)::int AS total FROM customers c
        WHERE c.is_deleted = false AND c.property_type::text = ${propertyType}
          AND (c.name ILIKE ${searchFilter} OR c.phone ILIKE ${searchFilter} OR c.customer_id ILIKE ${searchFilter})
      ` : search && leadSource ? sql`
        SELECT COUNT(DISTINCT c.id)::int AS total FROM customers c
        WHERE c.is_deleted = false AND c.lead_source::text = ${leadSource}
          AND (c.name ILIKE ${searchFilter} OR c.phone ILIKE ${searchFilter} OR c.customer_id ILIKE ${searchFilter})
      ` : search ? sql`
        SELECT COUNT(DISTINCT c.id)::int AS total FROM customers c
        WHERE c.is_deleted = false
          AND (c.name ILIKE ${searchFilter} OR c.phone ILIKE ${searchFilter} OR c.customer_id ILIKE ${searchFilter})
      ` : propertyType && leadSource ? sql`
        SELECT COUNT(DISTINCT c.id)::int AS total FROM customers c
        WHERE c.is_deleted = false AND c.property_type::text = ${propertyType} AND c.lead_source::text = ${leadSource}
      ` : propertyType ? sql`
        SELECT COUNT(DISTINCT c.id)::int AS total FROM customers c
        WHERE c.is_deleted = false AND c.property_type::text = ${propertyType}
      ` : leadSource ? sql`
        SELECT COUNT(DISTINCT c.id)::int AS total FROM customers c
        WHERE c.is_deleted = false AND c.lead_source::text = ${leadSource}
      ` : sql`
        SELECT COUNT(*)::int AS total FROM customers WHERE is_deleted = false
      `,
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    return NextResponse.json({
      items: rows.map((row: any) => {
        const billed = Number(row.billed_amount ?? 0);
        const paid = Number(row.paid_amount ?? 0);
        return {
          ...row,
          total_orders: Number(row.total_orders ?? 0),
          completed_jobs: Number(row.completed_jobs ?? 0),
          billed_amount: billed,
          paid_amount: paid,
          due_amount: Math.max(0, billed - paid),
          total_spent: paid,
        };
      }),
      total,
      page,
      per_page,
      pages: Math.ceil(total / per_page),
    });
  } catch (err) {
    console.error("[Customers GET]", err);
    return NextResponse.json({ detail: "Failed to load customers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = requireAuthPayload(req);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.payload.sub;

  try {
    const body = await req.json();
    const { name, phone, alternate_phone, email, address, latitude, longitude, maps_url, gst_number, property_type, lead_source, notes } = body;

    if (!name?.trim()) return NextResponse.json({ detail: "Name is required" }, { status: 400 });
    if (!phone?.trim()) return NextResponse.json({ detail: "Phone is required" }, { status: 400 });
    if (!address?.trim()) return NextResponse.json({ detail: "Address is required" }, { status: 400 });
    if (!property_type) return NextResponse.json({ detail: "Property type is required" }, { status: 400 });

    const sql = neon(DB_URL);
    const maxRow = await sql`
      SELECT COALESCE(
        MAX(CAST(SPLIT_PART(customer_id, '-', 3) AS INTEGER)),
        0
      ) AS max_num
      FROM customers
      WHERE customer_id LIKE 'PX-C-%'
    `;
    const customer_id = `PX-C-${String((maxRow[0]?.max_num ?? 0) + 1).padStart(4, "0")}`;

    const rows = await sql`
      INSERT INTO customers(id,customer_id,name,phone,alternate_phone,email,address,latitude,longitude,maps_url,gst_number,property_type,lead_source,notes,created_by,is_deleted)
      VALUES(gen_random_uuid(),${customer_id},${name.trim()},${phone.trim()},${alternate_phone || null},${email || null},${address.trim()},${latitude || null},${longitude || null},${maps_url || null},${gst_number || null},${property_type},${lead_source || "OTHER"},${notes || null},${userId}::uuid,false)
      RETURNING id,customer_id,name,phone,alternate_phone,email,address,latitude,longitude,maps_url,gst_number,property_type,lead_source,notes,created_at,updated_at
    `;
    return NextResponse.json(
      { ...rows[0], total_orders: 0, completed_jobs: 0, billed_amount: 0, paid_amount: 0, due_amount: 0, total_spent: 0 },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("[Customers POST]", err);
    if (String(err).includes("unique")) return NextResponse.json({ detail: "Phone number already exists" }, { status: 409 });
    return NextResponse.json({ detail: "Failed to create customer" }, { status: 500 });
  }
}
