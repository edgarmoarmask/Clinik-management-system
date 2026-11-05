import type { UserPublic, UserRole } from "@/client"

export const ROLES: readonly UserRole[] = ["doctor", "cashier"]

export const ROLE_LABEL: Record<UserRole, string> = {
  doctor: "Doctor",
  cashier: "Cashier",
}

// Mirrors the backend's has_role: superusers pass every role check.
export function hasRole(
  user: UserPublic | null | undefined,
  ...roles: UserRole[]
): boolean {
  return (
    !!user && (user.is_superuser || (!!user.role && roles.includes(user.role)))
  )
}
