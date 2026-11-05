import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ShoppingCart } from "lucide-react"
import { useState } from "react"

import { CartService, type ProductRead } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

// Prescription-only products ask for a prescription reference first;
// checkout is rejected without one.
export function AddToCartButton({ product }: { product: ProductRead }) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [askRx, setAskRx] = useState(false)
  const [rx, setRx] = useState("")

  const mutation = useMutation({
    mutationFn: (prescription_ref: string | null) =>
      CartService.addItem({
        body: { product_id: product.id, quantity: 1, prescription_ref },
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(["cart"], res.data)
      showSuccessToast(`${product.name} added to cart`)
      setAskRx(false)
      setRx("")
    },
    onError: handleError.bind(showErrorToast),
  })

  const outOfStock = product.stock === 0

  return (
    <>
      <Button
        size="sm"
        disabled={outOfStock || mutation.isPending}
        onClick={() =>
          product.requires_prescription ? setAskRx(true) : mutation.mutate(null)
        }
      >
        <ShoppingCart />
        {outOfStock ? "Out of stock" : "Add"}
      </Button>
      <Dialog open={askRx} onOpenChange={setAskRx}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Prescription required</DialogTitle>
            <DialogDescription>
              {product.name} can only be sold with a prescription.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              mutation.mutate(rx.trim())
            }}
          >
            <div className="grid gap-2 py-2">
              <Label htmlFor={`rx-${product.id}`}>Prescription reference</Label>
              <Input
                id={`rx-${product.id}`}
                value={rx}
                maxLength={100}
                onChange={(e) => setRx(e.target.value)}
                required
              />
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <LoadingButton
                type="submit"
                loading={mutation.isPending}
                disabled={!rx.trim()}
              >
                Add to cart
              </LoadingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
