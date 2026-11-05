import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CalendarClock,
  CircleCheck,
  EllipsisVertical,
  RotateCcw,
  UserX,
  X,
} from "lucide-react"
import { useState } from "react"

import {
  type AppointmentPublic,
  type AppointmentStatus,
  AppointmentsService,
} from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useCustomToast from "@/hooks/useCustomToast"
import { APPOINTMENT_STATUS_LABEL } from "@/lib/appointments"
import { handleError } from "@/utils"
import { AppointmentDialog } from "./AppointmentDialog"

// Status changes are open to the appointment's doctor and to cashiers;
// rescheduling (`canReschedule`) only to cashiers/superusers.
export function AppointmentActions({
  appointment,
  canReschedule,
}: {
  appointment: AppointmentPublic
  canReschedule: boolean
}) {
  const [rescheduling, setRescheduling] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const setStatus = useMutation({
    mutationFn: (status: AppointmentStatus) =>
      AppointmentsService.updateAppointment({
        path: { id: appointment.id },
        body: { status },
      }),
    onSuccess: (res) =>
      showSuccessToast(
        `Marked as ${APPOINTMENT_STATUS_LABEL[res.data.status].toLowerCase()}`,
      ),
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
    },
  })

  const scheduled = appointment.status === "Scheduled"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={setStatus.isPending}
          >
            <EllipsisVertical />
            <span className="sr-only">Appointment actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {scheduled ? (
            <>
              <DropdownMenuItem onClick={() => setStatus.mutate("Completed")}>
                <CircleCheck />
                Mark completed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatus.mutate("NoShow")}>
                <UserX />
                Mark no-show
              </DropdownMenuItem>
              {canReschedule && (
                <DropdownMenuItem onClick={() => setRescheduling(true)}>
                  <CalendarClock />
                  Reschedule
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setStatus.mutate("Cancelled")}
              >
                <X />
                Cancel appointment
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={() => setStatus.mutate("Scheduled")}>
              <RotateCcw />
              Mark as scheduled again
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canReschedule && (
        <AppointmentDialog
          appointment={appointment}
          open={rescheduling}
          onOpenChange={setRescheduling}
        />
      )}
    </>
  )
}
