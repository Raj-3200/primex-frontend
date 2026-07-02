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
