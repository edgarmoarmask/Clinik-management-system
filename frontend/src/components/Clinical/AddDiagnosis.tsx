import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { ClinicalRecordsService, type PatientPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { emrNumber, fullName } from "@/lib/clinical"
import { handleError } from "@/utils"

const VISIT_TYPES = [
  { value: "Consultation", label: "Consultation" },
  { value: "FollowUp", label: "Follow-up" },
  { value: "LabResults", label: "Lab results" },
  { value: "Emergency", label: "Emergency" },
] as const

const formSchema = z.object({
  visit_type: z.enum(["Consultation", "FollowUp", "LabResults", "Emergency"]),
  diagnosis: z
    .string()
    .trim()
    .min(1, { message: "Diagnosis is required" })
    .max(1000),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

const EMPTY: FormData = { visit_type: "Consultation", diagnosis: "", notes: "" }

// Records a visit with the doctor's diagnosis for `patient`. The backend
// copies it to the patient's "Recent Diagnosis" and updates "Last Visit".
export function AddDiagnosis({
  patient,
  onClose,
}: {
  patient: PatientPublic | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: EMPTY,
  })

  // start fresh for each patient
  useEffect(() => {
    if (patient) form.reset(EMPTY)
  }, [patient, form])

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      if (!patient) throw new Error("No patient selected")
      return ClinicalRecordsService.recordsCreateClinicalRecord({
        body: {
          patient_id: patient.id,
          emr_number: emrNumber(patient.id),
          visit_date: new Date().toISOString(),
          physician_name: user?.full_name || user?.email || "Unknown",
          visit_type: data.visit_type,
          diagnosis: data.diagnosis,
          notes: data.notes || null,
        },
      })
    },
    onSuccess: () => {
      showSuccessToast("Diagnosis saved")
      onClose()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["clinical-records"] })
      queryClient.invalidateQueries({ queryKey: ["patients"] })
    },
  })

  return (
    <Dialog open={patient !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Diagnosis</DialogTitle>
          <DialogDescription>
            {patient &&
              `${fullName(patient)} · ${emrNumber(patient.id)} · ${patient.age} yrs`}
          </DialogDescription>
        </DialogHeader>
        {patient?.recent_diagnosis && (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Current diagnosis: </span>
            <span className="font-medium">{patient.recent_diagnosis}</span>
          </p>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="visit_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visit type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VISIT_TYPES.map((v) => (
                          <SelectItem key={v.value} value={v.value}>
                            {v.label}
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
                name="diagnosis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Diagnosis <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Essential hypertension"
                        maxLength={1000}
                        rows={3}
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Symptoms, findings, plan…"
                        rows={3}
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
                Save Diagnosis
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
