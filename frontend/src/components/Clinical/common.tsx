import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getInitials } from "@/utils"

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  warn,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  hint?: string
  warn?: boolean
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-start gap-3 px-4">
        <div
          className={cn(
            "rounded-lg p-2",
            warn
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {hint && (
            <p
              className={cn(
                "text-xs",
                warn ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {hint}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function PatientAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <Avatar className={className}>
      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">{message}</p>
  )
}

export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  label = (o) => o,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  label?: (o: T) => ReactNode
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="tab"
          aria-selected={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
            value === o
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          {label(o)}
        </button>
      ))}
    </div>
  )
}
