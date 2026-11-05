import {
  type AppointmentPublic,
  type AppointmentStatus,
  AppointmentsService,
} from "@/client"

// Cashiers/superusers get every appointment, doctors only their own (the API
// decides). A clinic's list is small enough to fetch whole and filter locally.
export function appointmentsQueryOptions() {
  return {
    queryKey: ["appointments"],
    queryFn: async () =>
      (await AppointmentsService.readAppointments({ query: { limit: 500 } }))
        .data,
  }
}

export function doctorsQueryOptions() {
  return {
    queryKey: ["appointments", "doctors"],
    queryFn: async () => (await AppointmentsService.listDoctors()).data,
  }
}

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  Scheduled: "Scheduled",
  Completed: "Completed",
  Cancelled: "Cancelled",
  NoShow: "No-show",
}

export const APPOINTMENT_STATUS_VARIANT: Record<
  AppointmentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Scheduled: "default",
  Completed: "secondary",
  Cancelled: "outline",
  NoShow: "destructive",
}

export const endTime = (a: AppointmentPublic) =>
  new Date(new Date(a.scheduled_at).getTime() + a.duration_minutes * 60_000)

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export const formatTime = (d: Date) =>
  d.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" })

export const formatDay = (d: Date) =>
  d.toLocaleDateString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })

// "YYYY-MM-DD" and "HH:MM" in local time, for <input type="date|time">.
export function toLocalInputs(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}
