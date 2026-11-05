import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export type Item = {
  icon: LucideIcon
  title: string
  path: string
  // shown as a dropdown under the item
  children?: SubItem[]
}

export type SubItem = {
  icon: LucideIcon
  title: string
  path: string
}

// sub-pages (e.g. a patient) keep their section highlighted
const inSection = (currentPath: string, path: string) =>
  currentPath === path || (path !== "/" && currentPath.startsWith(`${path}/`))

function NavGroup({
  item,
  currentPath,
  onNavigate,
}: {
  item: Item & { children: SubItem[] }
  currentPath: string
  onNavigate: () => void
}) {
  const { state } = useSidebar()
  const active = inSection(currentPath, item.path)
  const [open, setOpen] = useState(active)

  // open the group when navigating into it from elsewhere
  useEffect(() => {
    if (active) setOpen(true)
  }, [active])

  // the icon-only sidebar has no room for a dropdown: link to the section
  if (state === "collapsed") {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={item.title} isActive={active} asChild>
          <RouterLink to={item.path} onClick={onNavigate}>
            <item.icon />
            <span>{item.title}</span>
          </RouterLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.title}
        isActive={active && !open}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <item.icon />
        <span>{item.title}</span>
        <ChevronRight
          className={cn("ml-auto transition-transform", open && "rotate-90")}
        />
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub>
          {item.children.map((child) => (
            <SidebarMenuSubItem key={child.path}>
              <SidebarMenuSubButton
                asChild
                isActive={inSection(currentPath, child.path)}
              >
                <RouterLink to={child.path} onClick={onNavigate}>
                  <child.icon />
                  <span>{child.title}</span>
                </RouterLink>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}

interface MainProps {
  items: Item[]
}

export function Main({ items }: MainProps) {
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouterState()
  const currentPath = router.location.pathname

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            if (item.children) {
              return (
                <NavGroup
                  key={item.title}
                  item={{ ...item, children: item.children }}
                  currentPath={currentPath}
                  onNavigate={handleMenuClick}
                />
              )
            }
            const isActive = inSection(currentPath, item.path)

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive}
                  asChild
                >
                  <RouterLink to={item.path} onClick={handleMenuClick}>
                    <item.icon />
                    <span>{item.title}</span>
                  </RouterLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
