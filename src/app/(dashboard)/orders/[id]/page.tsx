"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sun, Droplets, Activity, User, Phone,
  MapPin, Calendar, IndianRupee, Clock, CheckCircle, UserCheck,
  MessageCircle, PhoneCall, CalendarClock, Loader2, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  formatSchedule, formatTime, getWhatsAppUrl,
  getJobReminderMessage, getPaymentReminderMessage,
} from "@/lib/business";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const SERVICE_ICONS: Record<string, any> = { SOLAR: Sun, TANK: Droplets, COMBINED: Activity };
const SERVICE_COLORS: Record<string, string> = {
  SOLAR: "bg-amber-500/15 text-amber-600",
  TANK: "bg-blue-500/15 text-blue-600",
  COMBINED: "bg-green-500/15 text-green-600",
};

const ACTIVE_STATUSES = ["PENDING", "SCHEDULED", "IN_PROGRESS"];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  // Dialog state
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id,
  });

  const { mutate: updateOrder, isPending: isUpdating } = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update order");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Order updated successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );

  if (!data) return (
    <div className="space-y-4">
      <Button variant="ghost" asChild><Link href="/orders"><ArrowLeft className="w-4 h-4 mr-2" />Back</Link></Button>
      <Card className="p-12 text-center rounded-2xl">
        <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Order not found</p>
      </Card>
    </div>
  );

  const { order, solar_detail, tank_detail, activity_logs = [] } = data;
  const Icon = SERVICE_ICONS[order.service_type] || Activity;
  const iconClass = SERVICE_COLORS[order.service_type] || "bg-muted text-muted-foreground";
  const isActive = ACTIVE_STATUSES.includes(order.status);
  const isCompleted = order.status === "COMPLETED";
  const waJobMsg = getJobReminderMessage({
    customerName: order.customer_name,
    orderNumber: order.order_number,
    serviceType: order.service_type,
    scheduledDate: order.scheduled_date,
    scheduledTime: order.scheduled_time,
  });
  const waPayMsg = getPaymentReminderMessage({
    customerName: order.customer_name,
    orderNumber: order.order_number,
    amount: Number(order.total_amount),
    serviceType: order.service_type,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/orders"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display">{order.order_number}</h1>
            <p className="text-sm text-muted-foreground">{order.service_type.replace("_", " ")} Service</p>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Action Bar */}
      {(isActive || isCompleted) && (
        <Card className="p-4 rounded-2xl">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-muted-foreground mr-1">Actions:</span>

            {isActive && (
              <>
                <Button
                  size="sm" className="rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-sm"
                  onClick={() => setShowComplete(true)} disabled={isUpdating}
                >
                  {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
                  Mark Completed
                </Button>
                <Button
                  size="sm" variant="outline" className="rounded-xl"
                  onClick={() => { setNewDate(order.scheduled_date?.slice(0, 10) || ""); setNewTime(order.scheduled_time?.slice(0, 5) || ""); setShowReschedule(true); }}
                >
                  <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
                  Reschedule
                </Button>
                <Button
                  size="sm" variant="outline" className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setShowCancel(true)} disabled={isUpdating}
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Cancel
                </Button>
              </>
            )}

            {order.customer_phone && (
              <>
                <a href={`tel:${order.customer_phone}`}>
                  <Button size="sm" variant="outline" className="rounded-xl">
                    <PhoneCall className="w-3.5 h-3.5 mr-1.5" />
                    Call
                  </Button>
                </a>
                <a
                  href={getWhatsAppUrl(order.customer_phone, isCompleted ? waPayMsg : waJobMsg)}
                  target="_blank" rel="noopener noreferrer"
                >
                  <Button size="sm" variant="outline" className="rounded-xl text-green-600 border-green-600/30 hover:bg-green-600/10">
                    <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                    WhatsApp
                  </Button>
                </a>
              </>
            )}

            {isCompleted && (
              <Link href="/invoices">
                <Button size="sm" variant="outline" className="rounded-xl">
                  <IndianRupee className="w-3.5 h-3.5 mr-1.5" />
                  View Invoice
                </Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer */}
          <Card className="p-5 rounded-2xl">
            <h2 className="text-sm font-bold font-display mb-3 text-muted-foreground uppercase tracking-wide">Customer</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <Link href={`/customers/${order.customer_id}`} className="font-semibold hover:text-primary transition-colors">
                  {order.customer_name}
                </Link>
              </div>
              {order.customer_phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <a href={`tel:${order.customer_phone}`} className="hover:text-foreground transition-colors">{order.customer_phone}</a>
                </div>
              )}
              {order.customer_address && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  {order.customer_address}
                </div>
              )}
            </div>
          </Card>

          {/* Schedule */}
          <Card className="p-5 rounded-2xl">
            <h2 className="text-sm font-bold font-display mb-3 text-muted-foreground uppercase tracking-wide">Schedule</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm col-span-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Scheduled</p>
                  <p className="font-medium">
                    {order.scheduled_date ? formatSchedule(order.scheduled_date, order.scheduled_time) : "Not scheduled"}
                  </p>
                </div>
              </div>
              {order.completed_at && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <p className="font-medium">{formatDate(order.completed_at)}</p>
                  </div>
                </div>
              )}
              {order.assigned_name && (
                <div className="flex items-center gap-2 text-sm">
                  <UserCheck className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned To</p>
                    <p className="font-medium">{order.assigned_name}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Service Details */}
          {solar_detail && (
            <Card className="p-5 rounded-2xl">
              <h2 className="text-sm font-bold font-display mb-3 text-muted-foreground uppercase tracking-wide">Solar Details</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Panel Count</p><p className="font-semibold">{solar_detail.panel_count}</p></div>
                <div><p className="text-xs text-muted-foreground">Capacity</p><p className="font-semibold">{solar_detail.capacity_kw} kW</p></div>
                <div><p className="text-xs text-muted-foreground">Roof Type</p><p className="font-semibold">{solar_detail.roof_type}</p></div>
                <div><p className="text-xs text-muted-foreground">Panel Type</p><p className="font-semibold">{solar_detail.panel_type}</p></div>
                {solar_detail.remarks && <div className="col-span-2"><p className="text-xs text-muted-foreground">Remarks</p><p className="font-medium">{solar_detail.remarks}</p></div>}
              </div>
            </Card>
          )}
          {tank_detail && (
            <Card className="p-5 rounded-2xl">
              <h2 className="text-sm font-bold font-display mb-3 text-muted-foreground uppercase tracking-wide">Tank Details</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Tank Type</p><p className="font-semibold">{tank_detail.tank_type}</p></div>
                <div><p className="text-xs text-muted-foreground">Capacity</p><p className="font-semibold">{tank_detail.capacity_liters}L</p></div>
                <div><p className="text-xs text-muted-foreground">No. of Tanks</p><p className="font-semibold">{tank_detail.number_of_tanks}</p></div>
                {tank_detail.chemical_used && <div><p className="text-xs text-muted-foreground">Chemical</p><p className="font-semibold">{tank_detail.chemical_used}</p></div>}
                {tank_detail.remarks && <div className="col-span-2"><p className="text-xs text-muted-foreground">Remarks</p><p className="font-medium">{tank_detail.remarks}</p></div>}
              </div>
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Pricing */}
          <Card className="p-5 rounded-2xl">
            <h2 className="text-sm font-bold font-display mb-3 text-muted-foreground uppercase tracking-wide">Pricing</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatCurrency(order.discount)}</span></div>}
              {order.tax_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax ({order.tax_rate}%)</span><span>{formatCurrency(order.tax_amount)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                <span>Total</span><span className="text-primary">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card className="p-5 rounded-2xl">
              <h2 className="text-sm font-bold font-display mb-2 text-muted-foreground uppercase tracking-wide">Notes</h2>
              <p className="text-sm text-muted-foreground">{order.notes}</p>
            </Card>
          )}

          {/* Activity Log */}
          <Card className="p-5 rounded-2xl">
            <h2 className="text-sm font-bold font-display mb-3 text-muted-foreground uppercase tracking-wide">Activity</h2>
            {activity_logs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity recorded</p>
            ) : (
              <div className="space-y-2">
                {activity_logs.map((log: any, i: number) => (
                  <motion.div key={log.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="flex gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <p className="font-medium">{log.action || log.message || "Action performed"}</p>
                      <p className="text-muted-foreground">{log.full_name} · {formatDate(log.created_at)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Reschedule Dialog */}
      <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reschedule Order</DialogTitle>
            <DialogDescription>Pick a new date and time for this job.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>New Date</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>New Time (optional)</Label>
              <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReschedule(false)} className="rounded-xl">Cancel</Button>
            <Button
              disabled={!newDate || isUpdating} className="rounded-xl"
              onClick={() => {
                updateOrder({ scheduled_date: newDate, scheduled_time: newTime || null });
                setShowReschedule(false);
              }}
            >
              {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-2" />}
              Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Completed Dialog */}
      <AlertDialog open={showComplete} onOpenChange={setShowComplete}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Completed?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark {order.order_number} as completed. You can then record a payment or send a receipt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-green-600 hover:bg-green-700"
              onClick={() => { updateOrder({ status: "COMPLETED" }); setShowComplete(false); }}
            >
              Mark Completed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancel} onOpenChange={setShowCancel}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel {order.order_number}. The customer will need to book again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Keep Order</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive hover:bg-destructive/90"
              onClick={() => { updateOrder({ status: "CANCELLED" }); setShowCancel(false); }}
            >
              Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
