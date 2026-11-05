import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { useDeferredValue, useState } from "react"

import { EmptyState, PageHeader } from "@/components/Clinical/common"
import { AddToCartButton } from "@/components/Shop/AddToCartButton"
import { CartPanel } from "@/components/Shop/CartPanel"
import ImportProducts from "@/components/Shop/ImportProducts"
import { ProductActionsMenu } from "@/components/Shop/ProductActionsMenu"
import ProductDialog from "@/components/Shop/ProductDialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import useAuth from "@/hooks/useAuth"
import { formatMoney, productsQueryOptions } from "@/lib/shop"

export const Route = createFileRoute("/_layout/products")({
  component: Products,
  head: () => ({
    meta: [
      {
        title: "Products - Wellness Center Management System",
      },
    ],
  }),
})

function Products() {
  const { user } = useAuth()
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search.trim())
  const { data: products, isLoading } = useQuery({
    ...productsQueryOptions(deferredSearch),
    placeholderData: (prev) => prev,
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Products" subtitle="Browse products and check out">
        {user?.is_superuser && (
          <>
            <ImportProducts />
            <ProductDialog />
          </>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name or generic name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <EmptyState message="Loading products…" />
          ) : !products?.length ? (
            <EmptyState
              message={
                search ? "No products match your search" : "No products yet"
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <Card key={p.id} className="py-4">
                  <CardContent className="flex h-full flex-col gap-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {[p.generic_name, p.strength, p.dosage_form]
                            .filter(Boolean)
                            .join(" · ") || p.sku}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {p.requires_prescription && (
                          <Badge variant="outline">Rx</Badge>
                        )}
                        {user?.is_superuser && (
                          <ProductActionsMenu product={p} />
                        )}
                      </div>
                    </div>
                    <div className="mt-auto flex items-end justify-between gap-2">
                      <div>
                        <p className="text-lg font-bold">
                          {formatMoney(p.price)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.stock} in stock
                        </p>
                      </div>
                      <AddToCartButton product={p} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <CartPanel />
      </div>
    </div>
  )
}
