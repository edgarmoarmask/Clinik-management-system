import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  ChevronRight,
  FileText,
  FlaskConical,
  RefreshCw,
  Search,
  Siren,
  Stethoscope,
  TriangleAlert,
} from "lucide-react"
import { useState } from "react"

import type { PatientPublic, VisitType } from "@/client"
import AddPatient from "@/components/Clinical/AddPatient"
import {
  EmptyState,
  PageHeader,
  PatientAvatar,
} from "@/components/Clinical/common"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import {
  clinicalRecordsQueryOptions,
  emrNumber,
  formatDate,
  formatDateTime,
  fullName,
  patientsQueryOptions,
} from "@/lib/clinical"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/clinical-records")({
  component: ClinicalRecords,
  head: () => ({
    meta: [
      {
        title: "Clinical Records - FastAPI Template",
      },
    ],
  }),
})

const VISIT_ICON: Record<VisitType, typeof FileText> = {
  Consultation: Stethoscope,
  LabResults: FlaskConical,
  FollowUp: RefreshCw,
  Emergency: Siren,
}

const VISIT_LABEL: Record<VisitType, string> = {
  Consultation: "Consultation",
  LabResults: "Lab Results Uploaded",
  FollowUp: "Follow-up",
  Emergency: "Emergency",
}

function PatientDetail({ patient }: { patient: PatientPublic }) {
  const records = useQuery(clinicalRecordsQueryOptions(patient.id))

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center gap-3 border-b">
        <PatientAvatar name={fullName(patient)} className="size-12 text-lg" />
        <div>
          <CardTitle className="text-lg">{fullName(patient)}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Patient File: {emrNumber(patient.id)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Recent Diagnosis</p>
            <p className="font-bold text-primary">
              {patient.recent_diagnosis ?? "—"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Blood Group</p>
            <p className="font-bold">{patient.blood_group ?? "—"}</p>
          </div>
        </div>

        {patient.chronic_conditions &&
          patient.chronic_conditions.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <TriangleAlert className="size-4" /> Chronic Conditions
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {patient.chronic_conditions.map((c) => (
                  <Badge key={c} variant="outline">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}

        <div>
          <h3 className="mb-1 text-sm font-semibold">Recent Activity</h3>
          {records.isLoading ? (
            <p className="py-2 text-sm text-muted-foreground">Loading…</p>
          ) : records.isError ? (
            <p className="py-2 text-sm text-destructive">
              Couldn't load clinical records.
            </p>
          ) : records.data?.data.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No recent activity recorded.
            </p>
          ) : (
            records.data?.data.map((r) => {
              const dt = formatDateTime(r.visit_date)
              const Icon = r.visit_type ? VISIT_ICON[r.visit_type] : FileText
              return (
                <div
                  key={r.id}
                  className="flex gap-3 border-b py-3 last:border-b-0"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">
                      {r.visit_type ? VISIT_LABEL[r.visit_type] : "Visit"}
                    </p>
                    {(r.diagnosis || r.notes) && (
                      <p className="text-sm text-muted-foreground">
                        {[r.diagnosis, r.notes].filter(Boolean).join(" — ")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {dt.date} • {dt.time} • {r.physician_name}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {patient.has_alert && patient.alert_message && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Clinical Alert</AlertTitle>
            <AlertDescription>{patient.alert_message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function ClinicalRecords() {
  const patients = useQuery(patientsQueryOptions())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const all = patients.data?.data ?? []
  const q = search.toLowerCase()
  const filtered = all.filter(
    (p) =>
      fullName(p).toLowerCase().includes(q) ||
      emrNumber(p.id).toLowerCase().includes(q) ||
      (p.physician_name ?? "").toLowerCase().includes(q),
  )
  // Default to the first patient until the user picks one.
  const selected = all.find((p) => p.id === selectedId) ?? all[0]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clinical Records"
        subtitle="Manage and review patient electronic health directories"
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="w-56 pl-8"
            placeholder="Search records"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <AddPatient />
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Patient Directory</CardTitle>
          </CardHeader>
          <CardContent>
            {patients.isLoading ? (
              <EmptyState message="Loading records…" />
            ) : patients.isError ? (
              <EmptyState message="Couldn't load patients." />
            ) : filtered.length === 0 ? (
              <EmptyState
                message={
                  all.length === 0
                    ? "No patients yet. Add one to get started."
                    : "No patients match your search."
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead>Physician</TableHead>
                    <TableHead>
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={cn(
                        "cursor-pointer",
                        selected?.id === p.id && "bg-primary/10",
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <PatientAvatar
                            name={fullName(p)}
                            className="size-9"
                          />
                          <div>
                            <p className="font-semibold">{fullName(p)}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.gender ?? "—"}, {p.age} yrs
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-primary">
                        #{emrNumber(p.id)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(p.last_visit)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.physician_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="size-4 text-primary" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {!patients.isLoading && (
            <p className="px-6 text-xs text-muted-foreground">
              Showing {filtered.length} of {patients.data?.count ?? 0} records
            </p>
          )}
        </Card>

        {selected && <PatientDetail patient={selected} />}
      </div>
    </div>
  )
}
