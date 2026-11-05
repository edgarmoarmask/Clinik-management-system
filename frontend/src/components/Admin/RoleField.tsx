import { useFormContext } from "react-hook-form"

import type { UserRole } from "@/client"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROLE_LABEL, ROLES } from "@/lib/roles"

// Radix Select can't use "" as a value, so "none" stands for no role.
export const NO_ROLE = "none"
export type RoleValue = UserRole | typeof NO_ROLE
export const roleValues = [NO_ROLE, ...ROLES] as [RoleValue, ...RoleValue[]]

export const toRole = (value: RoleValue): UserRole | null =>
  value === NO_ROLE ? null : value

// Must be rendered inside a <Form> whose values have a `role` field.
export function RoleField() {
  const { control } = useFormContext<{ role: RoleValue }>()

  return (
    <FormField
      control={control}
      name="role"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Role</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value={NO_ROLE}>No role</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
