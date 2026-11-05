import { useQuery } from "@tanstack/react-query"
import {
  FileText,
  FlaskConical,
  Plus,
  RefreshCw,
  Siren,
  Stethoscope,
  TriangleAlert,
} from "lucide-react"

import type { PatientPublic, VisitType } from "@/client"
import { EmptyState, PatientAvatar } from "@/components/Clinical/common"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
} from "@/lib/clinical"

const VISIT_ICON: Record<VisitType, typeof FileText> = {
  Consultation: Stethoscope,
  LabResults: FlaskConical,
  FollowUp: RefreshCw,
  Emergency: Siren,
}

const VISIT_LABEL: Record<VisitType, string> = {
  Consultation: "Consultation",
  LabResults: "Lab Results",
  FollowUp: "Follow-up",
  Emergency: "Emergency",
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-bold">{value}</p>
    </div>
  )
}

const withUnit = (v: number | null | undefined, unit: string) =>
  v == null ? "—" : `${v} ${unit}`

function bmi({ weight_kg, height_cm }: PatientPublic) {
  if (!weight_kg || !height_cm) return null
  return (weight_kg / (height_cm / 100) ** 2).toFixed(1)
}

// A patient's summary and every recorded visit with its diagnosis.
export function PatientHistory({
  patient,
  onAddDiagnosis,
}: {
  patient: PatientPublic
  // shown only to users allowed to diagnose
  onAddDiagnosis?: () => void
}) {
  const records = useQuery(clinicalRecordsQueryOptions(patient.id))
  const visits = records.data?.data ?? []

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-3 border-b">
        <PatientAvatar name={fullName(patient)} className="size-12 text-lg" />
        <div className="min-w-0 flex-1">
          <CardTitle className="text-lg">{fullName(patient)}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {emrNumber(patient.id)} · {patient.gender ?? "—"}, {patient.age} yrs
          </p>
        </div>
        {onAddDiagnosis && (
          <Button size="sm" onClick={onAddDiagnosis}>
            <Plus />
            Add Diagnosis
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {patient.has_alert && patient.alert_message && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Clinical Alert</AlertTitle>
            <AlertDescription>{patient.alert_message}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            label="Recent Diagnosis"
            value={patient.recent_diagnosis ?? "—"}
          />
          <Tile label="Blood Group" value={patient.blood_group ?? "—"} />
          <Tile label="Last Visit" value={formatDate(patient.last_visit)} />
          <Tile label="Total Visits" value={records.data?.count ?? "—"} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Weight" value={withUnit(patient.weight_kg, "kg")} />
          <Tile label="Height" value={withUnit(patient.height_cm, "cm")} />
          <Tile label="BMI" value={bmi(patient) ?? "—"} />
          <Tile label="Blood Pressure" value={patient.blood_pressure ?? "—"} />
        </div>
        <p className="-mt-2 text-sm text-muted-foreground">
          Physician: {patient.physician_name ?? "—"}
        </p>

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
          <h3 className="mb-2 text-sm font-semibold">Visit History</h3>
          {records.isLoading ? (
            <EmptyState message="Loading visits…" />
          ) : records.isError ? (
            <EmptyState message="Couldn't load the visit history." />
          ) : visits.length === 0 ? (
            <EmptyState message="No visits recorded yet." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Visit</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Physician</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visits.map((r) => {
                    const dt = formatDateTime(r.visit_date)
                    const Icon = r.visit_type
                      ? VISIT_ICON[r.visit_type]
                      : FileText
                    return (
                      <TableRow key={r.id} className="align-top">
                        <TableCell className="whitespace-nowrap">
                          <p>{dt.date}</p>
                          <p className="text-xs text-muted-foreground">
                            {dt.time}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <Icon className="size-4 text-primary" />
                            {r.visit_type ? VISIT_LABEL[r.visit_type] : "Visit"}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-48 whitespace-normal">
                          <p className="font-medium">
                            {r.diagnosis || (
                              <span className="italic text-muted-foreground">
                                No diagnosis
                              </span>
                            )}
                          </p>
                          {r.notes && (
                            <p className="text-xs text-muted-foreground">
                              {r.notes}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.physician_name}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
