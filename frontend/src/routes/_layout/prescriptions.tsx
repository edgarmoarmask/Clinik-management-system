import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CircleCheck, Pill, Search, TriangleAlert } from "lucide-react"
import { useMemo, useState } from "react"

import {
  type PrescriptionPublic,
  type PrescriptionStatus,
  type PrescriptionsPublic,
  PrescriptionsService,
} from "@/client"
import AddPrescription from "@/components/Clinical/AddPrescription"
import {
  EmptyState,
  FilterTabs,
  PageHeader,
  StatCard,
} from "@/components/Clinical/common"
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
import useCustomToast from "@/hooks/useCustomToast"
import {
  formatDate,
  fullName,
  patientsQueryOptions,
  prescriptionsQueryOptions,
} from "@/lib/clinical"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/prescriptions")({
  component: Prescriptions,
  head: () => ({
    meta: [
      {
        title: "E-Prescriptions - FastAPI Template",
      },
    ],
  }),
})

const STATUS_VARIANT = {
  Active: "default",
  Completed: "secondary",
  Cancelled: "outline",
} as const

const FILTERS = ["All", "Active", "Completed", "Cancelled"] as const

function Prescriptions() {
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()
  const patients = useQuery(patientsQueryOptions())
  const prescriptions = useQuery(prescriptionsQueryOptions())
  const [filter, setFilter] = useState<PrescriptionStatus | "All">("All")
  const [search, setSearch] = useState("")

  const patientName = useMemo(() => {
    const names = new Map(
      (patients.data?.data ?? []).map((p) => [p.id, fullName(p)]),
    )
    return (id: string) => names.get(id) ?? "Unknown patient"
  }, [patients.data])

  const all = prescriptions.data?.data ?? []
  const visible = useMemo(() => {
    const q = search.toLowerCase()
    return all
      .filter((r) => filter === "All" || r.status === filter)
      .filter(
        (r) =>
          r.medication.toLowerCase().includes(q) ||
          patientName(r.patient_id).toLowerCase().includes(q) ||
          r.prescribed_by.toLowerCase().includes(q),
      )
  }, [all, filter, search, patientName])

  // Optimistic status change, rolled back if the API call fails.
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PrescriptionStatus }) =>
      PrescriptionsService.updatePrescription({
        path: { id },
        body: { status },
      }),
    onMutate: async ({ id, status }) => {
      const queryKey = prescriptionsQueryOptions().queryKey
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<PrescriptionsPublic>(queryKey)
      queryClient.setQueryData<PrescriptionsPublic>(
        queryKey,
        (old) =>
          old && {
            ...old,
            data: old.data.map((r) => (r.id === id ? { ...r, status } : r)),
          },
      )
      return { previous }
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(
        prescriptionsQueryOptions().queryKey,
        context?.previous,
      )
      handleError.call(showErrorToast, err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] })
    },
  })

  const active = all.filter((r) => r.status === "Active")
  const unchecked = active.filter((r) => !r.allergy_checked)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="E-Prescriptions"
        subtitle="Issue, track and manage patient prescriptions"
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="w-60 pl-8"
            placeholder="Search medication or patient"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <AddPrescription patients={patients.data?.data ?? []} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Pill} label="Active" value={active.length} />
        <StatCard
          icon={TriangleAlert}
          label="Awaiting Allergy Check"
          value={unchecked.length}
          warn={unchecked.length > 0}
        />
        <StatCard
          icon={CircleCheck}
          label="Completed"
          value={all.filter((r) => r.status === "Completed").length}
        />
      </div>

      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />

      <Card>
        <CardHeader>
          <CardTitle>Prescriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {prescriptions.isLoading ? (
            <EmptyState message="Loading prescriptions…" />
          ) : prescriptions.isError ? (
            <EmptyState message="Couldn't load prescriptions." />
          ) : visible.length === 0 ? (
            <EmptyState message="No prescriptions match this view." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medication</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Dosage</TableHead>
                  <TableHead>Prescribed</TableHead>
                  <TableHead>Allergy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <PrescriptionRow
                    key={r.id}
                    rx={r}
                    patientName={patientName(r.patient_id)}
                    onStatus={(status) =>
                      setStatus.mutate({ id: r.id, status })
                    }
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PrescriptionRow({
  rx,
  patientName,
  onStatus,
}: {
  rx: PrescriptionPublic
  patientName: string
  onStatus: (status: PrescriptionStatus) => void
}) {
  const status = rx.status ?? "Active"
  return (
    <TableRow>
      <TableCell>
        <p className="font-semibold">{rx.medication}</p>
        <p className="text-xs text-muted-foreground">{rx.frequency}</p>
      </TableCell>
      <TableCell>{patientName}</TableCell>
      <TableCell className="text-muted-foreground">{rx.dosage}</TableCell>
      <TableCell>
        <p className="text-muted-foreground">
          {formatDate(rx.prescribed_date)}
        </p>
        <p className="text-xs text-muted-foreground">{rx.prescribed_by}</p>
      </TableCell>
      <TableCell>
        {rx.allergy_checked ? (
          <Badge variant="secondary">Checked</Badge>
        ) : (
          <Badge variant="destructive">Not checked</Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
      </TableCell>
      <TableCell>
        {status === "Active" && (
          <div className="flex justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatus("Completed")}
            >
              Complete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStatus("Cancelled")}
            >
              Cancel
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}
