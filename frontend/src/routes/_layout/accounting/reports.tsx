import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/Clinical/common"
import { ProfitAndLossReport } from "@/components/Shop/ProfitAndLossReport"

export const Route = createFileRoute("/_layout/accounting/reports")({
  component: Reports,
  head: () => ({
    meta: [
      {
        title: "Accounting Reports - Wellness Center Management System",
      },
    ],
  }),
})

function Reports() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        subtitle="Profit and loss by chart-of-accounts code"
      />
      <ProfitAndLossReport />
    </div>
  )
}
