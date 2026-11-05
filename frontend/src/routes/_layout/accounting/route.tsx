import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { UsersService } from "@/client"
import { hasRole } from "@/lib/roles"

// Accounting section (reports, transactions): cashiers and superusers only.
export const Route = createFileRoute("/_layout/accounting")({
  component: Outlet,
  beforeLoad: async () => {
    const { data: user } = await UsersService.readUserMe()
    if (!hasRole(user, "cashier")) {
      throw redirect({
        to: "/",
      })
    }
  },
})
