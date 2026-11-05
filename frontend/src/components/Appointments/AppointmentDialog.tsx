import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarPlus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type AppointmentPublic, AppointmentsService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import { doctorsQueryOptions, toLocalInputs } from "@/lib/appointments"
import { emrNumber, fullName, patientsQueryOptions } from "@/lib/clinical"
import { handleError } from "@/utils"

const DURATIONS = ["15", "30", "45", "60", "90"] as const

const formSchema = z
  .object({
    patient_id: z.string().min(1, { message: "Select a patient" }),
    doctor_id: z.string().min(1, { message: "Select a doctor" }),
    date: z.string().min(1, { message: "Pick a date" }),
    time: z.string().min(1, { message: "Pick a time" }),
    duration: z.enum(DURATIONS),
    reason: z.string().max(1000).optional(),
  })
  .refine((v) => !Number.isNaN(new Date(`${v.date}T${v.time}`).getTime()), {
    message: "Invalid date or time",
    path: ["time"],
  })

type FormData = z.infer<typeof formSchema>

// Next half hour from now, as the default slot for a new booking.
function nextSlot() {
  const d = new Date()
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0)
  return d
}

function toFormValues(appt?: AppointmentPublic): FormData {
  const { date, time } = toLocalInputs(
    appt ? new Date(appt.scheduled_at) : nextSlot(),
  )
  const duration = String(appt?.duration_minutes ?? 30)
  return {
    patient_id: appt?.patient_id ?? "",
    doctor_id: appt?.doctor_id ?? "",
    date,
    time,
    duration: (DURATIONS as readonly string[]).includes(duration)
      ? (duration as FormData["duration"])
      : "30",
    reason: appt?.reason ?? "",
  }
}

interface AppointmentDialogProps {
  // When given, the dialog reschedules this appointment; otherwise it books one.
  appointment?: AppointmentPublic
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AppointmentDialog({
  appointment,
  open,
  onOpenChange,
}: AppointmentDialogProps) {
  const [ownOpen, setOwnOpen] = useState(false)
  const isOpen = open ?? ownOpen
  const isEdit = appointment !== undefined
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const patients = useQuery({ ...patientsQueryOptions(), enabled: isOpen })
  const doctors = useQuery({ ...doctorsQueryOptions(), enabled: isOpen })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: toFormValues(appointment),
  })

  const setOpen = (next: boolean) => {
    // load fresh values every time the dialog opens
    if (next) form.reset(toFormValues(appointment))
    onOpenChange ? onOpenChange(next) : setOwnOpen(next)
  }

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const fields = {
        doctor_id: data.doctor_id,
        scheduled_at: new Date(`${data.date}T${data.time}`).toISOString(),
        duration_minutes: Number(data.duration),
        reason: data.reason || null,
      }
      return isEdit
        ? AppointmentsService.updateAppointment({
            path: { id: appointment.id },
            body: fields,
          })
        : AppointmentsService.createAppointment({
            body: { ...fields, patient_id: data.patient_id },
          })
    },
    onSuccess: () => {
      showSuccessToast(isEdit ? "Appointment updated" : "Appointment booked")
      setOpen(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
    },
  })

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button>
            <CalendarPlus className="mr-2" />
            New Appointment
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Reschedule Appointment" : "New Appointment"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `${appointment.patient_name} with ${appointment.doctor_name}`
              : "Book a patient with a doctor."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
            <div className="grid gap-4 py-4">
              {!isEdit && (
                <FormField
                  control={form.control}
                  name="patient_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Patient <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a patient…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(patients.data?.data ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {fullName(p)} ({emrNumber(p.id)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="doctor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Doctor <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              doctors.data?.length === 0
                                ? "No doctors yet: set a user's role in Admin"
                                : "Select a doctor…"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(doctors.data ?? []).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Date <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Time <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="time" step={300} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DURATIONS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m} minutes
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Follow-up on blood pressure"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={mutation.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <LoadingButton type="submit" loading={mutation.isPending}>
                {isEdit ? "Save" : "Book"}
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
