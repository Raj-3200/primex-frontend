import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getDb } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  try {
    const sql = getDb();
    const employees = await sql`
      SELECT id, email, full_name, phone, role, is_active, created_at
      FROM users WHERE is_deleted = false ORDER BY created_at DESC
    `;
    const total = employees.length;
    const admins = employees.filter((e: any) => e.role === "ADMIN").length;
    const managers = employees.filter((e: any) => e.role === "MANAGER").length;
    const technicians = employees.filter((e: any) => e.role === "TECHNICIAN").length;
    return NextResponse.json({ employees, stats: { total, admins, managers, technicians } });
  } catch (err) {
    console.error("[Employees API]", err);
    return NextResponse.json({ detail: "Failed to load employees" }, { status: 500 });
  }
}
