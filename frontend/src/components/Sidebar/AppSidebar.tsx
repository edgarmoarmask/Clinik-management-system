import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  FileHeart,
  FileText,
  Home,
  Landmark,
  Pill,
  Receipt,
  ShoppingBag,
  Users,
} from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { hasRole } from "@/lib/roles"
import { type Item, Main } from "./Main"
import { User } from "./User"

const baseItems: Item[] = [
  { icon: Home, title: "Dashboard", path: "/" },
  { icon: ClipboardList, title: "Patient Queue", path: "/queue" },
  { icon: FileHeart, title: "Clinical Records", path: "/clinical-records" },
  { icon: Pill, title: "Prescriptions", path: "/prescriptions" },
  { icon: BarChart3, title: "Analytics", path: "/analytics" },
  { icon: ShoppingBag, title: "Products", path: "/products" },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  const items = [
    ...baseItems,
    ...(hasRole(currentUser, "cashier", "doctor")
      ? [{ icon: CalendarClock, title: "Appointments", path: "/appointments" }]
      : []),
    ...(hasRole(currentUser, "cashier")
      ? [
          {
            icon: Landmark,
            title: "Accounting",
            path: "/accounting",
            children: [
              { icon: FileText, title: "Reports", path: "/accounting/reports" },
              {
                icon: Receipt,
                title: "Transactions",
                path: "/accounting/transactions",
              },
            ],
          },
        ]
      : []),
    ...(currentUser?.is_superuser
      ? [{ icon: Users, title: "Admin", path: "/admin" }]
      : []),
  ]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
