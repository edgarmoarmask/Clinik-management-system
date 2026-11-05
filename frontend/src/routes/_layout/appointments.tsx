import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { CalendarCheck, CalendarDays, Clock, Search } from "lucide-react"
import { useState } from "react"

import { type AppointmentPublic, UsersService } from "@/client"
import { AppointmentActions } from "@/components/Appointments/AppointmentActions"
import { AppointmentDialog } from "@/components/Appointments/AppointmentDialog"
import {
  EmptyState,
  FilterTabs,
  PageHeader,
  StatCard,
} from "@/components/Clinical/common"
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
import useAuth from "@/hooks/useAuth"
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_VARIANT,
  appointmentsQueryOptions,
  endTime,
  formatDay,
  formatTime,
  isSameDay,
} from "@/lib/appointments"
import { hasRole } from "@/lib/roles"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/appointments")({
  component: Appointments,
  beforeLoad: async () => {
    const { data: user } = await UsersService.readUserMe()
    if (!hasRole(user, "cashier", "doctor")) {
      throw redirect({ to: "/" })
    }
  },
  head: () => ({
    meta: [
      {
        title: "Appointments - Wellness Center Management System",
      },
    ],
  }),
})

const VIEWS = ["today", "upcoming", "past", "all"] as const
type View = (typeof VIEWS)[number]

const VIEW_LABEL: Record<View, string> = {
  today: "Today",
  upcoming: "Upcoming",
  past: "Past",
  all: "All",
}

function inView(a: AppointmentPublic, view: View, now: Date) {
  const start = new Date(a.scheduled_at)
  switch (view) {
    case "today":
      return isSameDay(start, now)
    case "upcoming":
      return endTime(a) >= now
    case "past":
      return endTime(a) < now
    case "all":
      return true
  }
}

function Appointments() {
  const { user } = useAuth()
  // cashiers (and superusers) book for any doctor; doctors see their own
  const isBooker = hasRole(user, "cashier")
  const appointments = useQuery(appointmentsQueryOptions())
  const [view, setView] = useState<View>("upcoming")
  const [search, setSearch] = useState("")

  const now = new Date()
  const all = appointments.data?.data ?? []
  const q = search.toLowerCase()
  const filtered = all
    .filter((a) => inView(a, view, now))
    .filter(
      (a) =>
        !q ||
        a.patient_name.toLowerCase().includes(q) ||
        a.doctor_name.toLowerCase().includes(q) ||
        (a.reason ?? "").toLowerCase().includes(q),
    )
  // past appointments read best newest-first
  const visible = view === "past" ? filtered.reverse() : filtered

  const scheduled = all.filter((a) => a.status === "Scheduled")
  const today = scheduled.filter((a) =>
    isSameDay(new Date(a.scheduled_at), now),
  )
  const next = scheduled.find((a) => endTime(a) >= now)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={isBooker ? "Appointments" : "My Appointments"}
        subtitle={
          isBooker
            ? "Book patients with doctors and track visits"
            : "Your upcoming patients"
        }
      >
        {isBooker && <AppointmentDialog />}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={CalendarDays}
          label="Today"
          value={today.length}
          hint="Scheduled appointments"
        />
        <StatCard
          icon={Clock}
          label="Next appointment"
          value={next ? formatTime(new Date(next.scheduled_at)) : "—"}
          hint={
            next
              ? `${formatDay(new Date(next.scheduled_at))} · ${next.patient_name}`
              : "Nothing scheduled"
          }
        />
        <StatCard
          icon={CalendarCheck}
          label="Upcoming"
          value={scheduled.filter((a) => endTime(a) >= now).length}
          hint="Scheduled from now on"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Schedule</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={
                isBooker ? "Search patient, doctor, reason…" : "Search patient…"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FilterTabs
            options={VIEWS}
            value={view}
            onChange={setView}
            label={(v) => VIEW_LABEL[v]}
          />
          {appointments.isLoading ? (
            <EmptyState message="Loading appointments…" />
          ) : appointments.isError ? (
            <EmptyState message="Couldn't load appointments." />
          ) : visible.length === 0 ? (
            <EmptyState message="No appointments here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Patient</TableHead>
                  {isBooker && <TableHead>Doctor</TableHead>}
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((a) => {
                  const start = new Date(a.scheduled_at)
                  return (
                    <TableRow
                      key={a.id}
                      className={cn(
                        a.status !== "Scheduled" && "text-muted-foreground",
                      )}
                    >
                      <TableCell className="whitespace-nowrap">
                        {formatDay(start)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {formatTime(start)} – {formatTime(endTime(a))}
                      </TableCell>
                      <TableCell className="font-medium">
                        {a.patient_name}
                      </TableCell>
                      {isBooker && <TableCell>{a.doctor_name}</TableCell>}
                      <TableCell className="max-w-xs truncate">
                        {a.reason || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={APPOINTMENT_STATUS_VARIANT[a.status]}>
                          {APPOINTMENT_STATUS_LABEL[a.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <AppointmentActions
                          appointment={a}
                          canReschedule={isBooker}
                        />
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
