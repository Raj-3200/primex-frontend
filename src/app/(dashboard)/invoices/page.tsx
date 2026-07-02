'use client';
import { API_BASE } from '@/lib/backend';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FileText,
  XCircle,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  Eye,
  MessageCircle,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { downloadCsv, getPaymentReminderMessage, getWhatsAppUrl } from '@/lib/business';

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('access_token') || '';
}

async function fetchInvoices() {
  const res = await fetch(`${API_BASE}/invoices`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch invoices');
  return res.json();
}

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; classes: string }
> = {
  PAID: {
    label: 'Paid',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    classes: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  UNPAID: {
    label: 'Unpaid',
    icon: <Clock className="h-3.5 w-3.5" />,
    classes: 'text-yellow-700 bg-yellow-50 dark:bg-yellow-950/40 dark:text-yellow-300',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: <XCircle className="h-3.5 w-3.5" />,
    classes: 'text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300',
  },
};

export default function InvoicesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoices'],
    queryFn: fetchInvoices,
    staleTime: 1000 * 60 * 2,
  });

  const invoices = data?.invoices ?? [];

  const totalInvoiced = invoices.reduce(
    (sum: number, inv: any) => sum + Number(inv.total_amount || 0),
    0
  );
  const paidInvoices = invoices.filter((inv: any) => inv.invoice_status === 'PAID');
  const pendingInvoices = invoices.filter((inv: any) => inv.invoice_status === 'UNPAID');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All billing records for your service orders
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCsv('primex-invoices.csv', invoices.map((invoice: any) => ({
            invoice: `INV-${invoice.order_number}`,
            customer: invoice.customer_name,
            service: invoice.service_type,
            amount: invoice.total_amount,
            paid: invoice.paid_amount,
            balance: invoice.balance_amount,
            status: invoice.invoice_status,
            due_date: invoice.due_date,
          })))}>
            <Download className="h-4 w-4 mr-1" />Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />Print
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border shadow-sm p-6 bg-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-xl p-2.5 bg-orange-50">
              <FileText className="h-5 w-5 text-orange-500" />
            </div>
            <p className="text-xs text-muted-foreground">Total Invoiced</p>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalInvoiced)}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{invoices.length} invoices</p>
        </div>

        <div className="rounded-2xl border border-border shadow-sm p-6 bg-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-xl p-2.5 bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-xs text-muted-foreground">Paid</p>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(
                paidInvoices.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0)
              )}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{paidInvoices.length} paid</p>
        </div>

        <div className="rounded-2xl border border-border shadow-sm p-6 bg-card col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-xl p-2.5 bg-yellow-50">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <p className="text-xs text-muted-foreground">Outstanding</p>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(
                pendingInvoices.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0)
              )}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{pendingInvoices.length} pending</p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl border border-border shadow-sm p-6 bg-card">
        <h2 className="text-base font-semibold text-foreground mb-4">Invoice List</h2>

        {isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <XCircle className="h-10 w-10 text-destructive mb-3" />
            <p className="text-muted-foreground">Failed to load invoices. Please try again.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No invoices found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Invoices are generated when orders are created with amounts.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv: any) => {
                const status = statusConfig[inv.invoice_status] ?? statusConfig.UNPAID;
                const reminder = getPaymentReminderMessage({
                  customerName: inv.customer_name,
                  orderNumber: inv.order_number,
                  amount: Number(inv.balance_amount || inv.total_amount || 0),
                  serviceType: inv.service_type,
                });
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono font-semibold text-orange-600">
                      INV-{inv.order_number}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {inv.customer_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {inv.customer_email || '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-muted-foreground">
                        {inv.service_type}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {formatCurrency(Number(inv.total_amount))}
                    </TableCell>
                    <TableCell className="text-emerald-600 font-medium">
                      {formatCurrency(Number(inv.paid_amount || 0))}
                    </TableCell>
                    <TableCell className="text-amber-600 font-medium">
                      {formatCurrency(Number(inv.balance_amount || 0))}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.classes}`}
                      >
                        {status.icon}
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(inv.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(inv.due_date || inv.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                          <Link href={`/orders/${inv.id}`} title="View order">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8" disabled={!inv.customer_phone || inv.invoice_status !== 'UNPAID'}>
                          <a href={getWhatsAppUrl(inv.customer_phone, reminder)} target="_blank" rel="noreferrer" title="WhatsApp reminder">
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
