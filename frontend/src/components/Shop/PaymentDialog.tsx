import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { type PaymentMethod, type PaymentRead, PaymentsService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import { formatMoney, METHOD_LABEL, PAYMENT_METHODS } from "@/lib/shop"
import { handleError } from "@/utils"

// Settles a pending payment. There is no real gateway: the cashier (or the
// customer, in this demo) records the method and an optional reference.
// Wire a provider such as Stripe into /payments/{id}/confirm for production.
export function PaymentDialog({
  payment,
  onClose,
}: {
  payment: PaymentRead | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [method, setMethod] = useState<PaymentMethod>("card")
  const [reference, setReference] = useState("")

  const onSettled = () => {
    for (const key of ["payments", "cart", "products"]) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
  const close = () => {
    setReference("")
    onClose()
  }

  const pay = useMutation({
    mutationFn: (id: number) =>
      PaymentsService.confirmPayment({
        path: { payment_id: id },
        body: {
          success: true,
          method,
          transaction_ref: reference || null,
        },
      }),
    onSuccess: () => {
      showSuccessToast("Payment received")
      close()
    },
    onError: handleError.bind(showErrorToast),
    onSettled,
  })

  const cancel = useMutation({
    mutationFn: (id: number) =>
      PaymentsService.cancelPayment({ path: { payment_id: id } }),
    onSuccess: () => {
      showSuccessToast("Payment cancelled, items returned to the cart")
      close()
    },
    onError: handleError.bind(showErrorToast),
    onSettled,
  })

  const busy = pay.isPending || cancel.isPending

  return (
    <Dialog open={payment !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment #{payment?.id}</DialogTitle>
          <DialogDescription>
            Amount due:{" "}
            <span className="font-semibold text-foreground">
              {payment && formatMoney(payment.amount)}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Payment method</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {METHOD_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transaction-ref">Transaction reference</Label>
            <Input
              id="transaction-ref"
              placeholder="Optional, e.g. card slip or transfer number"
              value={reference}
              maxLength={100}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => payment && cancel.mutate(payment.id)}
          >
            Cancel payment
          </Button>
          <LoadingButton
            loading={pay.isPending}
            disabled={busy}
            onClick={() => payment && pay.mutate(payment.id)}
          >
            Pay {payment && formatMoney(payment.amount)}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
