import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"

import { AddDiagnosis } from "@/components/Clinical/AddDiagnosis"
import { EmptyState } from "@/components/Clinical/common"
import { PatientHistory } from "@/components/Clinical/PatientHistory"
import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"
import { patientQueryOptions } from "@/lib/clinical"
import { hasRole } from "@/lib/roles"

export const Route = createFileRoute("/_layout/clinical-records/$patientId")({
  component: PatientPage,
  head: () => ({
    meta: [
      {
        title: "Patient History - Wellness Center Management System",
      },
    ],
  }),
})

function PatientPage() {
  const { patientId } = Route.useParams()
  const patient = useQuery(patientQueryOptions(patientId))
  const { user } = useAuth()
  const canDiagnose = hasRole(user, "doctor")
  const [diagnosing, setDiagnosing] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/clinical-records">
            <ArrowLeft />
            Patient Directory
          </Link>
        </Button>
      </div>

      {patient.isLoading ? (
        <EmptyState message="Loading patient…" />
      ) : patient.isError || !patient.data ? (
        <EmptyState message="Patient not found." />
      ) : (
        <>
          <PatientHistory
            patient={patient.data}
            onAddDiagnosis={canDiagnose ? () => setDiagnosing(true) : undefined}
          />
          <AddDiagnosis
            patient={diagnosing ? patient.data : null}
            onClose={() => setDiagnosing(false)}
          />
        </>
      )}
    </div>
  )
}
