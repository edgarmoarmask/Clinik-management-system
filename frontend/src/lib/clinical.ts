import {
  ClinicalRecordsService,
  type PatientPublic,
  PatientsService,
  PrescriptionsService,
} from "@/client"

// Pages aggregate over the full lists (counts, charts, lookups), so fetch
// generously rather than the template's default page of 100.
const LIST_LIMIT = 1000

export function patientsQueryOptions() {
  return {
    queryKey: ["patients"],
    queryFn: async () =>
      (
        await PatientsService.readPatients({
          query: { skip: 0, limit: LIST_LIMIT },
        })
      ).data,
  }
}

export function patientQueryOptions(id: string) {
  return {
    queryKey: ["patients", id],
    queryFn: async () =>
      (await PatientsService.readPatient({ path: { id } })).data,
  }
}

export function clinicalRecordsQueryOptions(patientId?: string) {
  return {
    queryKey: ["clinical-records", { patientId }],
    queryFn: async () =>
      (
        await ClinicalRecordsService.recordsReadClinicalRecords({
          query: { skip: 0, limit: LIST_LIMIT, patient_id: patientId },
        })
      ).data,
  }
}

export function prescriptionsQueryOptions() {
  return {
    queryKey: ["prescriptions"],
    queryFn: async () =>
      (
        await PrescriptionsService.readPrescriptions({
          query: { skip: 0, limit: LIST_LIMIT },
        })
      ).data,
  }
}

export const fullName = (p: Pick<PatientPublic, "first_name" | "last_name">) =>
  `${p.first_name} ${p.last_name}`

export const emrNumber = (id: string) => `EMR-${id.slice(-4).toUpperCase()}`

export function formatDate(iso?: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

export function formatDateTime(iso: string) {
  const d = new Date(iso)
  return {
    date: formatDate(iso),
    time: d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  }
}

/** Visit counts for the last `months` calendar months, oldest first. */
export function monthlyVisits(visitDates: string[], months: number) {
  const now = new Date()
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      value: 0,
    }
  })
  const index = new Map(buckets.map((b, i) => [b.key, i]))
  for (const iso of visitDates) {
    const d = new Date(iso)
    const i = index.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (i !== undefined) buckets[i].value++
  }
  return buckets.map(({ label, value }) => ({ label, value }))
}
