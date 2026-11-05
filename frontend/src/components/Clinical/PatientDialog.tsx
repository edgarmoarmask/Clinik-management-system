import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type PatientPublic, PatientsService } from "@/client"
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
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
import useCustomToast from "@/hooks/useCustomToast"
import { doctorsQueryOptions } from "@/lib/appointments"
import { handleError } from "@/utils"

// Optional positive number up to `max`, typed into a text field.
const measurement = (max: number) =>
  z.string().refine((v) => v === "" || (Number(v) > 0 && Number(v) <= max), {
    message: `Enter a number between 0 and ${max}`,
  })

const formSchema = z.object({
  first_name: z.string().min(1, { message: "First name is required" }),
  last_name: z.string().min(1, { message: "Last name is required" }),
  age: z
    .string()
    .regex(/^\d{1,3}$/, { message: "Enter a valid age" })
    .refine((v) => Number(v) <= 150, { message: "Enter a valid age" }),
  gender: z.enum(["F", "M", "Other"]),
  physician_id: z.string().optional(),
  weight_kg: measurement(500),
  height_cm: measurement(300),
  blood_pressure: z.string().regex(/^(\d{2,3}\/\d{2,3})?$/, {
    message: "Use systolic/diastolic, e.g. 120/80",
  }),
})

type FormData = z.infer<typeof formSchema>

function toFormValues(p?: PatientPublic): FormData {
  const text = (v?: number | string | null) => (v == null ? "" : String(v))
  return {
    first_name: p?.first_name ?? "",
    last_name: p?.last_name ?? "",
    age: text(p?.age),
    gender: p?.gender ?? "F",
    physician_id: p?.physician_id ?? "",
    weight_kg: text(p?.weight_kg),
    height_cm: text(p?.height_cm),
    blood_pressure: p?.blood_pressure ?? "",
  }
}

interface PatientDialogProps {
  // When given, the dialog edits this patient; otherwise it creates one.
  patient?: PatientPublic
  onSuccess?: () => void
}

const PatientDialog = ({ patient, onSuccess }: PatientDialogProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const isEdit = patient !== undefined
  const queryClient = useQueryClient()
  const doctors = useQuery({ ...doctorsQueryOptions(), enabled: isOpen })
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: toFormValues(patient),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const body = {
        ...data,
        age: Number(data.age),
        physician_id: data.physician_id || null,
        weight_kg: data.weight_kg ? Number(data.weight_kg) : null,
        height_cm: data.height_cm ? Number(data.height_cm) : null,
        blood_pressure: data.blood_pressure || null,
      }
      if (!isEdit) return PatientsService.createPatient({ body })
      // Older patients have a typed-in physician name and no physician_id;
      // only send the doctor when it was changed so that name is kept.
      return PatientsService.updatePatient({
        path: { id: patient.id },
        body: form.formState.dirtyFields.physician_id
          ? body
          : { ...body, physician_id: undefined },
      })
    },
    onSuccess: () => {
      showSuccessToast(
        isEdit
          ? "Patient updated successfully"
          : "Patient created successfully",
      )
      setIsOpen(false)
      onSuccess?.()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] })
    },
  })

  const onOpenChange = (open: boolean) => {
    // load fresh values every time the dialog opens
    if (open) form.reset(toFormValues(patient))
    setIsOpen(open)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {isEdit ? (
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          onClick={() => onOpenChange(true)}
        >
          <Pencil />
          Edit Patient
        </DropdownMenuItem>
      ) : (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2" />
            New Patient
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Patient" : "New Patient Record"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the patient's details."
              : "Fill in the details to add a patient to the directory."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        First Name <span className="text-destructive">*</span>
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
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Last Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Age <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
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
                          <SelectItem value="F">Female</SelectItem>
                          <SelectItem value="M">Male</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="weight_kg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (kg)</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          placeholder="70"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="height_cm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height (cm)</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          placeholder="170"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="blood_pressure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blood Pressure</FormLabel>
                      <FormControl>
                        <Input placeholder="120/80" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="physician_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Physician</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              doctors.data?.length === 0
                                ? "No doctors yet: set a user's role in Admin"
                                : (patient?.physician_name ??
                                  "Select a doctor…")
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
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={mutation.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <LoadingButton type="submit" loading={mutation.isPending}>
                {isEdit ? "Save" : "Create Record"}
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default PatientDialog
