import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react"
import { useState } from "react"

import { type CartRead, CartService, type PaymentRead } from "@/client"
import { EmptyState } from "@/components/Clinical/common"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingButton } from "@/components/ui/loading-button"
import { Separator } from "@/components/ui/separator"
import useCustomToast from "@/hooks/useCustomToast"
import { cartQueryOptions, formatMoney } from "@/lib/shop"
import { handleError } from "@/utils"
import { PaymentDialog } from "./PaymentDialog"

export function CartPanel() {
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()
  const { data: cart, isLoading } = useQuery(cartQueryOptions())
  const [payment, setPayment] = useState<PaymentRead | null>(null)

  // Every cart endpoint returns the updated cart, so write it straight
  // into the cache instead of refetching.
  const onCartChanged = (res: { data: CartRead }) =>
    queryClient.setQueryData(["cart"], res.data)

  const updateQty = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) =>
      CartService.updateItem({ path: { item_id: id }, body: { quantity } }),
    onSuccess: onCartChanged,
    onError: handleError.bind(showErrorToast),
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      CartService.removeItem({ path: { item_id: id } }),
    onSuccess: onCartChanged,
    onError: handleError.bind(showErrorToast),
  })

  const checkout = useMutation({
    mutationFn: () => CartService.checkout(),
    onSuccess: (res) => setPayment(res.data),
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      // checkout empties the cart and reserves stock
      for (const key of ["cart", "products", "payments"]) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
    },
  })

  const items = cart?.items ?? []
  const busy = updateQty.isPending || remove.isPending

  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="size-5" />
          Cart
          {items.length > 0 && (
            <Badge variant="secondary">{items.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <EmptyState message="Loading cart…" />
        ) : items.length === 0 ? (
          <EmptyState message="Your cart is empty" />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(item.unit_price)} each
                  </p>
                  {item.requires_prescription && (
                    <p className="text-xs text-muted-foreground">
                      Rx: {item.prescription_ref}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={busy || item.quantity <= 1}
                    onClick={() =>
                      updateQty.mutate({
                        id: item.id,
                        quantity: item.quantity - 1,
                      })
                    }
                  >
                    <Minus className="size-3" />
                    <span className="sr-only">Decrease</span>
                  </Button>
                  <span className="w-6 text-center text-sm">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={busy}
                    onClick={() =>
                      updateQty.mutate({
                        id: item.id,
                        quantity: item.quantity + 1,
                      })
                    }
                  >
                    <Plus className="size-3" />
                    <span className="sr-only">Increase</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    disabled={busy}
                    onClick={() => remove.mutate(item.id)}
                  >
                    <Trash2 className="size-3" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
                <span className="w-20 text-right text-sm font-medium">
                  {formatMoney(item.line_total)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Separator />
        <div className="flex items-center justify-between font-semibold">
          <span>Total</span>
          <span>{formatMoney(cart?.total ?? 0)}</span>
        </div>
        <LoadingButton
          loading={checkout.isPending}
          disabled={items.length === 0 || busy}
          onClick={() => checkout.mutate()}
        >
          Checkout
        </LoadingButton>
      </CardContent>
      <PaymentDialog payment={payment} onClose={() => setPayment(null)} />
    </Card>
  )
}
