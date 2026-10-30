import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { useMemo, useState } from "react"

import CheckInPatient from "@/components/Clinical/CheckInPatient"
import {
  EmptyState,
  FilterTabs,
  PageHeader,
  PatientAvatar,
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
import useQueue, {
  minutesWaiting,
  PRIORITY_RANK,
  PRIORITY_VARIANT,
  type QueueStatus,
  STATUS_LABEL,
} from "@/hooks/useQueue"
import { patientsQueryOptions } from "@/lib/clinical"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/queue")({
  component: PatientQueue,
  head: () => ({
    meta: [
      {
        title: "Patient Queue - FastAPI Template",
      },
    ],
  }),
})

const FILTERS = ["All", "Waiting", "InConsultation", "Completed"] as const

function PatientQueue() {
  const { queue, updateQueue } = useQueue()
  const patients = useQuery(patientsQueryOptions())
  const [filter, setFilter] = useState<QueueStatus | "All">("All")
  const [search, setSearch] = useState("")

  const visible = useMemo(() => {
    const q = search.toLowerCase()
    return queue
      .filter((e) => filter === "All" || e.status === filter)
      .filter(
        (e) =>
          e.patientName.toLowerCase().includes(q) ||
          e.reason.toLowerCase().includes(q) ||
          e.physicianName.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        // Completed last; otherwise by priority, then by arrival time.
        if ((a.status === "Completed") !== (b.status === "Completed"))
          return a.status === "Completed" ? 1 : -1
        const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        return byPriority || a.arrivedAt.localeCompare(b.arrivedAt)
      })
  }, [queue, filter, search])

  const count = (f: QueueStatus | "All") =>
    f === "All" ? queue.length : queue.filter((e) => e.status === f).length

  const advance = (id: string) =>
    updateQueue((qs) =>
      qs.map((e) => {
        if (e.id !== id) return e
        const next: QueueStatus =
          e.status === "Waiting" ? "InConsultation" : "Completed"
        return { ...e, status: next }
      }),
    )

  const clearCompleted = () =>
    updateQueue((qs) => qs.filter((e) => e.status !== "Completed"))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patient Queue"
        subtitle="Live view of patients waiting and in consultation"
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="w-56 pl-8"
            placeholder="Search queue"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <CheckInPatient patients={patients.data?.data ?? []} />
      </PageHeader>

      <FilterTabs
        options={FILTERS}
        value={filter}
        onChange={setFilter}
        label={(f) => (
          <>
            {f === "All" ? "All" : STATUS_LABEL[f]}{" "}
            <span className="opacity-70">({count(f)})</span>
          </>
        )}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Today's Queue</CardTitle>
          {count("Completed") > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCompleted}>
              Clear completed
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <EmptyState message="No patients match this view." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Physician</TableHead>
                  <TableHead>Waiting</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((e) => {
                  const done = e.status === "Completed"
                  return (
                    <TableRow key={e.id} className={cn(done && "opacity-60")}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <PatientAvatar
                            name={e.patientName}
                            className="size-9"
                          />
                          <div>
                            <p className="font-semibold">{e.patientName}</p>
                            <p className="text-xs text-muted-foreground">
                              {e.gender ?? "—"}, {e.age} yrs
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{e.reason}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.physicianName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {done ? "—" : `${minutesWaiting(e.arrivedAt)} min`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PRIORITY_VARIANT[e.priority]}>
                          {e.priority}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-medium",
                          done ? "text-muted-foreground" : "text-primary",
                        )}
                      >
                        {STATUS_LABEL[e.status]}
                      </TableCell>
                      <TableCell className="text-right">
                        {!done && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => advance(e.id)}
                          >
                            {e.status === "Waiting" ? "Start" : "Complete"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
