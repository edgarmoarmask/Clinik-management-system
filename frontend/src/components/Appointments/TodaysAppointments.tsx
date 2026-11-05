import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { EmptyState, PatientAvatar } from "@/components/Clinical/common"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_VARIANT,
  appointmentsQueryOptions,
  endTime,
  formatTime,
  isSameDay,
} from "@/lib/appointments"
import { cn } from "@/lib/utils"

// Dashboard card for doctors: today's appointments, first one up next.
export function TodaysAppointments() {
  const { data, isLoading } = useQuery(appointmentsQueryOptions())
  const now = new Date()
  const today = (data?.data ?? []).filter(
    (a) => a.status !== "Cancelled" && isSameDay(new Date(a.scheduled_at), now),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Appointments Today</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/appointments">All appointments →</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {isLoading ? (
          <EmptyState message="Loading…" />
        ) : today.length === 0 ? (
          <EmptyState message="No appointments today." />
        ) : (
          today.map((a) => {
            const done = a.status !== "Scheduled" || endTime(a) < now
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-center gap-3 border-b px-6 py-3 last:border-b-0",
                  done && "opacity-60",
                )}
              >
                <span className="w-28 shrink-0 text-sm font-semibold">
                  {formatTime(new Date(a.scheduled_at))} –{" "}
                  {formatTime(endTime(a))}
                </span>
                <PatientAvatar name={a.patient_name} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.patient_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.reason || "No reason given"}
                  </p>
                </div>
                <Badge variant={APPOINTMENT_STATUS_VARIANT[a.status]}>
                  {APPOINTMENT_STATUS_LABEL[a.status]}
                </Badge>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
