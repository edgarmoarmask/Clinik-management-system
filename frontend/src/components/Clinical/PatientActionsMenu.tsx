import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import type { PatientPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeletePatient from "./DeletePatient"
import PatientDialog from "./PatientDialog"

// Superuser-only edit/delete menu for a patient row.
export const PatientActionsMenu = ({ patient }: { patient: PatientPublic }) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <EllipsisVertical />
          <span className="sr-only">Patient actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <PatientDialog patient={patient} onSuccess={() => setOpen(false)} />
        <DeletePatient patient={patient} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
