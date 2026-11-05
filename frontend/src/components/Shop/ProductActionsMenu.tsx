import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import type { ProductRead } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteProduct from "./DeleteProduct"
import ProductDialog from "./ProductDialog"

export const ProductActionsMenu = ({ product }: { product: ProductRead }) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 -mr-2 -mt-1">
          <EllipsisVertical />
          <span className="sr-only">Product actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <ProductDialog product={product} onSuccess={() => setOpen(false)} />
        <DeleteProduct product={product} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
