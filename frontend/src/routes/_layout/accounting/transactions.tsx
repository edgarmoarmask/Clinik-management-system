import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Clock, Receipt, Search, TrendingUp, Wallet } from "lucide-react"
import { useMemo, useState } from "react"

import type { PaymentRead, PaymentStatus } from "@/client"
import {
  EmptyState,
  FilterTabs,
  PageHeader,
  StatCard,
} from "@/components/Clinical/common"
import AddPayment from "@/components/Shop/AddPayment"
import { PaymentDialog } from "@/components/Shop/PaymentDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/clinical"
import {
  accountsQueryOptions,
  formatMoney,
  METHOD_LABEL,
  paymentsQueryOptions,
  paymentsSummaryQueryOptions,
  STATUS_VARIANT,
} from "@/lib/shop"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/accounting/transactions")({
  component: Transactions,
  head: () => ({
    meta: [
      {
        title: "Transactions - Wellness Center Management System",
      },
    ],
  }),
})

const FILTERS = ["all", "paid", "pending", "failed", "cancelled"] as const

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const describe = (p: PaymentRead) =>
  p.description ||
  (p.cart_id ? `Checkout · order #${p.cart_id}` : capitalize(p.kind))

// Expenses are stored as positive amounts and shown as negative.
const signedAmount = (p: PaymentRead) =>
  p.kind === "expense" ? -Number(p.amount) : Number(p.amount)

function Transactions() {
  const payments = useQuery(paymentsQueryOptions())
  const summary = useQuery(paymentsSummaryQueryOptions())
  const accounts = useQuery(accountsQueryOptions())
  const accountName = useMemo(() => {
    const names = new Map((accounts.data ?? []).map((a) => [a.code, a.name]))
    return (code: string) => names.get(code) ?? ""
  }, [accounts.data])
  const [filter, setFilter] = useState<PaymentStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [settling, setSettling] = useState<PaymentRead | null>(null)

  const all = payments.data?.data ?? []
  const visible = useMemo(() => {
    const q = search.toLowerCase()
    return all
      .filter((p) => filter === "all" || p.status === filter)
      .filter(
        (p) =>
          !q ||
          describe(p).toLowerCase().includes(q) ||
          p.account_code.includes(q) ||
          accountName(p.account_code).toLowerCase().includes(q) ||
          (p.transaction_ref ?? "").toLowerCase().includes(q) ||
          String(p.id) === q,
      )
  }, [all, filter, search, accountName])

  const s = summary.data
  const profit = Number(s?.profit ?? 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transactions"
        subtitle="Payments received and expenses"
      >
        <AddPayment kind="expense" />
        <AddPayment />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Total received"
          value={formatMoney(s?.total_paid ?? 0)}
          hint={`${s?.count_paid ?? 0} paid payments, all time`}
        />
        <StatCard
          icon={Receipt}
          label="Expenses"
          value={formatMoney(-Number(s?.total_expenses ?? 0))}
        />
        <StatCard
          icon={TrendingUp}
          label="Profit"
          value={formatMoney(profit)}
          hint="All time, received minus expenses"
          warn={profit < 0}
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={formatMoney(s?.total_pending ?? 0)}
          hint={`${s?.count_pending ?? 0} awaiting payment`}
          warn={(s?.count_pending ?? 0) > 0}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Transactions</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search description, account or reference…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FilterTabs
            options={FILTERS}
            value={filter}
            onChange={setFilter}
            label={capitalize}
          />
          {payments.isLoading ? (
            <EmptyState message="Loading payments…" />
          ) : visible.length === 0 ? (
            <EmptyState message="No transactions found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.id}
                    </TableCell>
                    <TableCell>
                      {formatDate(p.paid_at ?? p.created_at)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {describe(p)}
                    </TableCell>
                    <TableCell className="max-w-48">
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground">
                          {p.account_code}
                        </span>
                        <span className="truncate text-sm">
                          {accountName(p.account_code)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      {p.method ? METHOD_LABEL[p.method] : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.transaction_ref || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[p.status]}>
                        {capitalize(p.status)}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        p.kind === "expense" && "text-destructive",
                      )}
                    >
                      {formatMoney(signedAmount(p))}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSettling(p)}
                        >
                          Settle
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {(payments.data?.count ?? 0) > all.length && (
            <p className="text-xs text-muted-foreground">
              Showing the latest {all.length} of {payments.data?.count}{" "}
              payments.
            </p>
          )}
        </CardContent>
      </Card>

      <PaymentDialog payment={settling} onClose={() => setSettling(null)} />
    </div>
  )
}
