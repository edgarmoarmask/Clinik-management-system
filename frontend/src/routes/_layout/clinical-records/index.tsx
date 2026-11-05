import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ChevronRight, Search } from "lucide-react"
import { useState } from "react"

import {
  EmptyState,
  PageHeader,
  PatientAvatar,
} from "@/components/Clinical/common"
import { PatientActionsMenu } from "@/components/Clinical/PatientActionsMenu"
import PatientDialog from "@/components/Clinical/PatientDialog"
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
import useAuth from "@/hooks/useAuth"
import {
  emrNumber,
  formatDate,
  fullName,
  patientsQueryOptions,
} from "@/lib/clinical"

export const Route = createFileRoute("/_layout/clinical-records/")({
  component: ClinicalRecords,
  head: () => ({
    meta: [
      {
        title: "Clinical Records - Wellness Center Management System",
      },
    ],
  }),
})

function ClinicalRecords() {
  const patients = useQuery(patientsQueryOptions())
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = !!user?.is_superuser
  const [search, setSearch] = useState("")

  const all = patients.data?.data ?? []
  const q = search.toLowerCase()
  const filtered = all.filter(
    (p) =>
      fullName(p).toLowerCase().includes(q) ||
      emrNumber(p.id).toLowerCase().includes(q) ||
      (p.physician_name ?? "").toLowerCase().includes(q),
  )

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
        <PatientDialog />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Patient Directory</CardTitle>
          <p className="text-sm text-muted-foreground">
            Click a patient to see their visit history.
          </p>
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
                    onClick={() =>
                      navigate({
                        to: "/clinical-records/$patientId",
                        params: { patientId: p.id },
                      })
                    }
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <PatientAvatar name={fullName(p)} className="size-9" />
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
                      {canManage ? (
                        // keep menu and dialog clicks (which bubble through
                        // React portals) from opening the patient page
                        // biome-ignore lint/a11y/noStaticElementInteractions: click barrier only
                        // biome-ignore lint/a11y/useKeyWithClickEvents: click barrier only
                        <div
                          className="flex justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PatientActionsMenu patient={p} />
                        </div>
                      ) : (
                        <ChevronRight className="size-4 text-primary" />
                      )}
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
    </div>
  )
}
