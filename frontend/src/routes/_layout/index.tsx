import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Clock, Pill, Stethoscope, Users } from "lucide-react"
import { ColumnChart } from "@/components/Clinical/charts"
import {
  EmptyState,
  PageHeader,
  PatientAvatar,
  StatCard,
} from "@/components/Clinical/common"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"
import useQueue, { minutesWaiting, PRIORITY_VARIANT } from "@/hooks/useQueue"
import {
  clinicalRecordsQueryOptions,
  emrNumber,
  formatDate,
  fullName,
  monthlyVisits,
  patientsQueryOptions,
  prescriptionsQueryOptions,
} from "@/lib/clinical"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Dashboard - FastAPI Template",
      },
    ],
  }),
})

function Dashboard() {
  const { user: currentUser } = useAuth()
  const { queue } = useQueue()
  const patients = useQuery(patientsQueryOptions())
  const prescriptions = useQuery(prescriptionsQueryOptions())
  const records = useQuery(clinicalRecordsQueryOptions())

  const waiting = queue.filter((q) => q.status === "Waiting")
  const inConsult = queue.filter((q) => q.status === "InConsultation")
  const urgent = waiting.filter((q) => q.priority !== "Routine")
  const activeRx = (prescriptions.data?.data ?? []).filter(
    (r) => r.status === "Active",
  )
  const unchecked = activeRx.filter((r) => !r.allergy_checked)
  const avgWait = waiting.length
    ? Math.round(
        waiting.reduce((a, q) => a + minutesWaiting(q.arrivedAt), 0) /
          waiting.length,
      )
    : 0

  const visits = monthlyVisits(
    (records.data?.data ?? []).map((r) => r.visit_date),
    6,
  )
  const recent = [...(patients.data?.data ?? [])]
    .filter((p) => p.last_visit)
    .sort((a, b) => (b.last_visit ?? "").localeCompare(a.last_visit ?? ""))
    .slice(0, 4)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hi, ${currentUser?.full_name || currentUser?.email} 👋`}
        subtitle="Today's clinic overview"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Patients"
          value={patients.isLoading ? "…" : (patients.data?.count ?? 0)}
          hint="In directory"
        />
        <StatCard
          icon={Clock}
          label="Waiting Now"
          value={waiting.length}
          hint={`Avg wait ${avgWait} min`}
        />
        <StatCard
          icon={Stethoscope}
          label="In Consultation"
          value={inConsult.length}
          hint={`${urgent.length} urgent in queue`}
        />
        <StatCard
          icon={Pill}
          label="Active Prescriptions"
          value={prescriptions.isLoading ? "…" : activeRx.length}
          hint={
            unchecked.length
              ? `${unchecked.length} need allergy check`
              : "All allergy-checked"
          }
          warn={unchecked.length > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Waiting Room</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/queue">View queue →</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            {waiting.length === 0 ? (
              <EmptyState message="No patients are waiting." />
            ) : (
              waiting.slice(0, 5).map((q) => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 border-b px-6 py-3 last:border-b-0"
                >
                  <PatientAvatar name={q.patientName} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{q.patientName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {q.reason}
                    </p>
                  </div>
                  <Badge variant={PRIORITY_VARIANT[q.priority]}>
                    {q.priority}
                  </Badge>
                  <span className="w-16 text-right text-sm text-muted-foreground">
                    {minutesWaiting(q.arrivedAt)} min
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Visits</CardTitle>
          </CardHeader>
          <CardContent>
            {records.isLoading ? (
              <EmptyState message="Loading…" />
            ) : (
              <ColumnChart data={visits} height={130} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recently Seen Patients</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/clinical-records">Open records →</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {patients.isLoading ? (
            <EmptyState message="Loading…" />
          ) : recent.length === 0 ? (
            <EmptyState message="No recent visits." />
          ) : (
            recent.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-2 items-center gap-2 border-b px-6 py-3 text-sm last:border-b-0 md:grid-cols-4"
              >
                <div className="flex items-center gap-2.5">
                  <PatientAvatar name={fullName(p)} />
                  <span className="font-semibold">{fullName(p)}</span>
                </div>
                <span className="font-medium text-primary">
                  #{emrNumber(p.id)}
                </span>
                <span className="text-muted-foreground">
                  {formatDate(p.last_visit)}
                </span>
                <span className="text-muted-foreground">
                  {p.physician_name ?? "—"}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
