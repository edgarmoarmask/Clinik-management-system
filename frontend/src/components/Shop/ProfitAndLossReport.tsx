import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import type { ReportLine } from "@/client"
import { EmptyState, FilterTabs } from "@/components/Clinical/common"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney, profitAndLossQueryOptions } from "@/lib/shop"
import { cn } from "@/lib/utils"

const PERIODS = ["this_month", "last_month", "this_year", "all"] as const
type Period = (typeof PERIODS)[number]

const PERIOD_LABEL: Record<Period, string> = {
  this_month: "This month",
  last_month: "Last month",
  this_year: "This year",
  all: "All time",
}

// Local-time period boundaries; `end` is exclusive.
function periodRange(period: Period): { start?: Date; end?: Date } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (period) {
    case "this_month":
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) }
    case "last_month":
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) }
    case "this_year":
      return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) }
    case "all":
      return {}
  }
}

function describePeriod(period: Period, range: { start?: Date; end?: Date }) {
  if (!range.start || !range.end) return "All recorded transactions"
  const last = new Date(range.end.getTime() - 1)
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  return `${PERIOD_LABEL[period]}: ${fmt(range.start)} – ${fmt(last)}`
}

function Row({
  label,
  amount,
  code,
  strong,
  negative,
  className,
}: {
  label: string
  amount: string | number
  code?: string
  strong?: boolean
  negative?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-1.5 text-sm",
        strong && "font-semibold",
        className,
      )}
    >
      <span className="flex min-w-0 items-baseline gap-2">
        {code && (
          <span className="font-mono text-xs text-muted-foreground">
            {code}
          </span>
        )}
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 tabular-nums">
        {formatMoney(negative ? -Number(amount) : amount)}
      </span>
    </div>
  )
}

function Section({
  title,
  lines,
  totalLabel,
  total,
  negative,
}: {
  title: string
  lines: ReportLine[]
  totalLabel: string
  total: string
  negative?: boolean
}) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {lines.length === 0 ? (
        <p className="py-1.5 text-sm italic text-muted-foreground">
          No entries
        </p>
      ) : (
        lines.map((l) => (
          <Row
            key={l.code}
            code={l.code}
            label={l.name}
            amount={l.amount}
            negative={negative}
          />
        ))
      )}
      <Row
        label={totalLabel}
        amount={total}
        negative={negative}
        strong
        className="border-t"
      />
    </div>
  )
}

// Cash-basis profit & loss: paid payments grouped by chart-of-accounts code.
export function ProfitAndLossReport() {
  const [period, setPeriod] = useState<Period>("this_month")
  const range = useMemo(() => periodRange(period), [period])
  const {
    data: report,
    isLoading,
    isError,
  } = useQuery(profitAndLossQueryOptions(range))

  const net = Number(report?.net_profit ?? 0)
  const revenue = Number(report?.total_revenue ?? 0)
  const margin = revenue ? Math.round((net / revenue) * 100) : null

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Profit &amp; Loss</CardTitle>
          <p className="text-sm text-muted-foreground">
            {describePeriod(period, range)} · paid transactions only
          </p>
        </div>
        <FilterTabs
          options={PERIODS}
          value={period}
          onChange={setPeriod}
          label={(p) => PERIOD_LABEL[p]}
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <EmptyState message="Loading report…" />
        ) : isError || !report ? (
          <EmptyState message="Couldn't load the report." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Section
                title="Revenue"
                lines={report.revenue}
                totalLabel="Total revenue"
                total={report.total_revenue}
              />
              <Section
                title="Cost of Sales"
                lines={report.cost_of_sales}
                totalLabel="Total cost of sales"
                total={report.total_cost_of_sales}
                negative
              />
              <Row
                label="Gross profit"
                amount={report.gross_profit}
                strong
                className="rounded-md bg-muted/50 px-3"
              />
            </div>
            <div className="flex flex-col gap-4">
              <Section
                title="Operating Expenses"
                lines={report.expenses}
                totalLabel="Total operating expenses"
                total={report.total_expenses}
                negative
              />
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg border p-4",
                  net < 0
                    ? "border-destructive/40 bg-destructive/10"
                    : "border-primary/30 bg-primary/10",
                )}
              >
                <div>
                  <p className="text-sm font-semibold">Net profit</p>
                  {margin !== null && (
                    <p className="text-xs text-muted-foreground">
                      {margin}% net margin
                    </p>
                  )}
                </div>
                <p
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    net < 0 ? "text-destructive" : "text-primary",
                  )}
                >
                  {formatMoney(net)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
