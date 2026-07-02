export type JobStatus =
  | "PENDING"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type JobGroup =
  | "needs_confirmation"
  | "today"
  | "upcoming"
  | "completed"
  | "cancelled";

export interface SchedulableJob {
  status: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
}

export type InvoiceStatus = "PAID" | "UNPAID" | "CANCELLED";

export interface FinancialMetricsInput {
  billed?: number | string | null;
  paid?: number | string | null;
  expenses?: number | string | null;
}

export interface FinancialMetrics {
  billed: number;
  paid: number;
  due: number;
  expenses: number;
  profit: number;
}

function toMoney(value: number | string | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function toDateKey(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

export function getLocalDateTime(
  dateValue: string | null | undefined,
  timeValue?: string | null,
): Date | null {
  const dateKey = toDateKey(dateValue);
  if (!dateKey) return null;
  const time = timeValue?.match(/^\d{2}:\d{2}/)?.[0] ?? "23:59";
  return new Date(`${dateKey}T${time}:00`);
}

export function formatTime(timeValue: string | null | undefined): string {
  const match = timeValue?.match(/^(\d{2}):(\d{2})/);
  if (!match) return "Time not set";
  const date = new Date(`2000-01-01T${match[1]}:${match[2]}:00`);
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function formatSchedule(
  dateValue: string | null | undefined,
  timeValue?: string | null,
): string {
  const dateKey = toDateKey(dateValue);
  if (!dateKey) return "Not scheduled";
  const date = new Date(`${dateKey}T12:00:00`);
  const dateText = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${dateText}${timeValue ? ` · ${formatTime(timeValue)}` : ""}`;
}

export function getJobGroup(job: SchedulableJob, now = new Date()): JobGroup {
  if (job.status === "COMPLETED") return "completed";
  if (job.status === "CANCELLED") return "cancelled";

  const todayKey = toDateKey(now);
  const jobDateKey = toDateKey(job.scheduled_date);
  const scheduledAt = getLocalDateTime(job.scheduled_date, job.scheduled_time);

  if (scheduledAt && scheduledAt < now) return "needs_confirmation";
  if (jobDateKey === todayKey) return "today";
  return "upcoming";
}

export function sortJobsBySchedule<T extends SchedulableJob>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => {
    const dateA = getLocalDateTime(a.scheduled_date, a.scheduled_time)?.getTime() ?? 0;
    const dateB = getLocalDateTime(b.scheduled_date, b.scheduled_time)?.getTime() ?? 0;
    return dateA - dateB;
  });
}

export function deriveFinancialMetrics(input: FinancialMetricsInput): FinancialMetrics {
  const billed = toMoney(input.billed);
  const paid = toMoney(input.paid);
  const expenses = toMoney(input.expenses);
  const due = Math.max(0, billed - paid);
  return {
    billed,
    paid,
    due,
    expenses,
    profit: paid - expenses,
  };
}

export function deriveInvoiceStatus(status: string | null | undefined): InvoiceStatus {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "COMPLETED") return "PAID";
  return "UNPAID";
}

export function getServiceLabel(serviceType: string | null | undefined): string {
  if (serviceType === "SOLAR") return "Solar Cleaning";
  if (serviceType === "TANK") return "Tank Cleaning";
  if (serviceType === "COMBINED") return "AMC / Combined Service";
  return "Service";
}

export function cleanPhoneForWhatsApp(phone: string | null | undefined): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function getWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const cleaned = cleanPhoneForWhatsApp(phone);
  return cleaned ? `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}` : "#";
}

export function getPaymentReminderMessage(input: {
  customerName: string;
  orderNumber: string;
  amount: number;
  serviceType?: string | null;
}): string {
  return `Hello ${input.customerName}, this is PrimeX Services. This is a friendly reminder for the pending payment of ₹${input.amount.toLocaleString("en-IN")} for ${getServiceLabel(input.serviceType)} (${input.orderNumber}). Please let us know once paid.`;
}

export function getJobReminderMessage(input: {
  customerName: string;
  orderNumber: string;
  serviceType?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
}): string {
  return `Hello ${input.customerName}, this is PrimeX Services. Your ${getServiceLabel(input.serviceType)} job ${input.orderNumber} is scheduled for ${formatSchedule(input.scheduledDate, input.scheduledTime)}. Please confirm availability.`;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (typeof window === "undefined" || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
