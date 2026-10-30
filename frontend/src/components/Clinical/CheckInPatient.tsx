import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { PatientPublic } from "@/client"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import useQueue from "@/hooks/useQueue"
import { emrNumber, fullName } from "@/lib/clinical"

const formSchema = z.object({
  patient_id: z.string().min(1, { message: "Select a patient" }),
  reason: z.string().min(1, { message: "Reason is required" }),
  physician_name: z.string().min(1, { message: "Physician is required" }),
  priority: z.enum(["Routine", "Urgent", "Emergency"]),
})

type FormData = z.infer<typeof formSchema>

const CheckInPatient = ({ patients }: { patients: PatientPublic[] }) => {
  const [isOpen, setIsOpen] = useState(false)
  const { updateQueue } = useQueue()
  const { showSuccessToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      patient_id: "",
      reason: "",
      physician_name: "",
      priority: "Routine",
    },
  })

  // Default the physician to the patient's assigned one when picked.
  const onPatientChange = (id: string) => {
    form.setValue("patient_id", id, { shouldValidate: true })
    const p = patients.find((x) => x.id === id)
    if (p?.physician_name && !form.getValues("physician_name")) {
      form.setValue("physician_name", p.physician_name)
    }
  }

  const onSubmit = (data: FormData) => {
    const p = patients.find((x) => x.id === data.patient_id)
    if (!p) return
    updateQueue((q) => [
      ...q,
      {
        id: crypto.randomUUID(),
        patientId: p.id,
        patientName: fullName(p),
        age: p.age,
        gender: p.gender,
        reason: data.reason,
        physicianName: data.physician_name,
        priority: data.priority,
        status: "Waiting",
        arrivedAt: new Date().toISOString(),
      },
    ])
    showSuccessToast(`${fullName(p)} added to the queue`)
    form.reset()
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2" />
          Check In Patient
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check In Patient</DialogTitle>
          <DialogDescription>
            Add a patient from the directory to today's queue.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="patient_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Patient <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select value={field.value} onValueChange={onPatientChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a patient…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {patients.map((p) => (
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
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Reason for Visit{" "}
                      <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} required />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="physician_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Physician <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Routine">Routine</SelectItem>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                          <SelectItem value="Emergency">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit">Add to Queue</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default CheckInPatient
