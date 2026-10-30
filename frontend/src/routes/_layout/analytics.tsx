import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Clock, RefreshCw, Siren, TrendingUp } from "lucide-react"
import { useMemo, useState } from "react"

import type { VisitType } from "@/client"
import { ColumnChart, HBars, LineChart } from "@/components/Clinical/charts"
import {
  EmptyState,
  FilterTabs,
  PageHeader,
  StatCard,
} from "@/components/Clinical/common"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import useQueue, { minutesWaiting } from "@/hooks/useQueue"
import {
  clinicalRecordsQueryOptions,
  monthlyVisits,
  patientsQueryOptions,
} from "@/lib/clinical"

export const Route = createFileRoute("/_layout/analytics")({
  component: Analytics,
  head: () => ({
    meta: [
      {
        title: "Analytics - FastAPI Template",
      },
    ],
  }),
})

const RANGES = ["3m", "6m"] as const
type Range = (typeof RANGES)[number]

const VISIT_LABEL: Record<VisitType, string> = {
  Consultation: "Consultation",
  LabResults: "Lab Results",
  FollowUp: "Follow-up",
  Emergency: "Emergency",
}

const AGE_GROUPS = [
  { label: "0–17", min: 0, max: 17 },
  { label: "18–34", min: 18, max: 34 },
  { label: "35–49", min: 35, max: 49 },
  { label: "50–64", min: 50, max: 64 },
  { label: "65+", min: 65, max: Number.POSITIVE_INFINITY },
]

const pct = (n: number, total: number) =>
  total ? Math.round((n / total) * 100) : 0

function Analytics() {
  const [range, setRange] = useState<Range>("6m")
  const months = range === "6m" ? 6 : 3
  const records = useQuery(clinicalRecordsQueryOptions())
  const patients = useQuery(patientsQueryOptions())
  const { queue } = useQueue()

  const stats = useMemo(() => {
    const all = records.data?.data ?? []
    const start = new Date()
    start.setMonth(start.getMonth() - (months - 1), 1)
    start.setHours(0, 0, 0, 0)
    const inRange = all.filter((r) => new Date(r.visit_date) >= start)

    const visits = monthlyVisits(
      inRange.map((r) => r.visit_date),
      months,
    )
    const first = visits[0].value
    const last = visits[visits.length - 1].value
    const growth = first ? Math.round(((last - first) / first) * 100) : null

    const byType = (t: VisitType) =>
      inRange.filter((r) => r.visit_type === t).length
    const visitMix = (Object.keys(VISIT_LABEL) as VisitType[]).map((t) => ({
      label: VISIT_LABEL[t],
      value: pct(byType(t), inRange.length),
    }))

    const diagnosisCounts = new Map<string, number>()
    for (const r of inRange) {
      const d = r.diagnosis?.trim()
      if (d) diagnosisCounts.set(d, (diagnosisCounts.get(d) ?? 0) + 1)
    }
    const diagnoses = [...diagnosisCounts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }))

    return {
      total: inRange.length,
      visits,
      growth,
      visitMix,
      diagnoses,
      followUpRate: pct(byType("FollowUp"), inRange.length),
      emergencyShare: pct(byType("Emergency"), inRange.length),
    }
  }, [records.data, months])

  const ageGroups = useMemo(() => {
    const ps = patients.data?.data ?? []
    return AGE_GROUPS.map((g) => ({
      label: g.label,
      value: ps.filter((p) => p.age >= g.min && p.age <= g.max).length,
    }))
  }, [patients.data])

  const waiting = queue.filter((q) => q.status === "Waiting")
  const avgWait = waiting.length
    ? `${Math.round(waiting.reduce((a, q) => a + minutesWaiting(q.arrivedAt), 0) / waiting.length)} min`
    : "—"

  const loading = records.isLoading || patients.isLoading

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        subtitle="Clinic activity and patient population insights"
      >
        <FilterTabs
          options={RANGES}
          value={range}
          onChange={setRange}
          label={(r) => `Last ${r === "3m" ? 3 : 6} months`}
        />
      </PageHeader>

      {loading ? (
        <EmptyState message="Loading analytics…" />
      ) : records.isError || patients.isError ? (
        <EmptyState message="Couldn't load analytics data." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={TrendingUp}
              label="Total Visits"
              value={stats.total.toLocaleString()}
              hint={
                stats.growth === null
                  ? "Over period"
                  : `${stats.growth >= 0 ? "+" : ""}${stats.growth}% over period`
              }
            />
            <StatCard
              icon={Clock}
              label="Avg Wait Time"
              value={avgWait}
              hint="Patients waiting now"
            />
            <StatCard
              icon={RefreshCw}
              label="Follow-up Rate"
              value={`${stats.followUpRate}%`}
              hint="Of all visits"
            />
            <StatCard
              icon={Siren}
              label="Emergency Share"
              value={`${stats.emergencyShare}%`}
              hint="Of all visits"
              warn={stats.emergencyShare > 0}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Visits Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart data={stats.visits} label="Monthly visits trend" />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Visit Types</CardTitle>
              </CardHeader>
              <CardContent>
                <HBars data={stats.visitMix} format={(v) => `${v}%`} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Diagnoses</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.diagnoses.length === 0 ? (
                  <EmptyState message="No diagnoses recorded in this period." />
                ) : (
                  <HBars data={stats.diagnoses} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Patients by Age Group</CardTitle>
              </CardHeader>
              <CardContent>
                <ColumnChart data={ageGroups} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
