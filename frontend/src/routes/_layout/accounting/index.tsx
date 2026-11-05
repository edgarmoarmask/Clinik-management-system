import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/accounting/")({
  beforeLoad: () => {
    throw redirect({ to: "/accounting/transactions" })
  },
})
