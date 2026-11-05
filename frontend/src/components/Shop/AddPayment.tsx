import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Minus, Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type AccountType, type PaymentKind, PaymentsService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import { accountsQueryOptions, METHOD_LABEL, PAYMENT_METHODS } from "@/lib/shop"
import { handleError } from "@/utils"

const formSchema = z.object({
  amount: z.string().refine((v) => Number(v) > 0, {
    message: "Amount must be greater than 0",
  }),
  account_code: z.string().min(1, { message: "Choose an account" }),
  method: z.enum(["cash", "card", "bank_transfer", "ewallet"]),
  status: z.enum(["paid", "pending"]),
  description: z.string().max(255).optional(),
  transaction_ref: z.string().max(100).optional(),
})

type FormData = z.infer<typeof formSchema>

const COPY = {
  income: {
    title: "Add Payment",
    description:
      "Record a payment received outside the checkout, e.g. a cash sale.",
    placeholder: "e.g. Walk-in sale",
    toast: "Payment recorded",
    accountLabel: "Income account",
  },
  expense: {
    title: "Add Expense",
    description: "Record money spent, e.g. rent, salaries or stock purchases.",
    placeholder: "e.g. Rent for November",
    toast: "Expense recorded",
    accountLabel: "Expense account",
  },
} as const

// Chart-of-accounts sections each kind may post to (mirrors app/coa.py).
const ACCOUNT_GROUPS: Record<
  PaymentKind,
  { type: AccountType; label: string }[]
> = {
  income: [{ type: "REVENUE", label: "Revenue" }],
  expense: [
    { type: "COGS", label: "Cost of Sales" },
    { type: "EXPENSE", label: "Operating Expenses" },
  ],
}

const AddPayment = ({ kind = "income" }: { kind?: PaymentKind }) => {
  const copy = COPY[kind]
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { data: accounts = [] } = useQuery(accountsQueryOptions())

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      amount: "",
      account_code: "",
      method: "cash",
      status: "paid",
      description: "",
      transaction_ref: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      PaymentsService.createPayment({
        body: {
          ...data,
          kind,
          description: data.description || null,
          transaction_ref: data.transaction_ref || null,
        },
      }),
    onSuccess: () => {
      showSuccessToast(copy.toast)
      form.reset()
      setIsOpen(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] })
    },
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={kind === "expense" ? "outline" : "default"}>
          {kind === "expense" ? (
            <Minus className="mr-2" />
          ) : (
            <Plus className="mr-2" />
          )}
          {copy.title}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Amount <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="account_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {copy.accountLabel}{" "}
                      <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select an account…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACCOUNT_GROUPS[kind].map((group) => (
                          <SelectGroup key={group.type}>
                            <SelectLabel>{group.label}</SelectLabel>
                            {accounts
                              .filter(
                                (a) => a.type === group.type && !a.is_header,
                              )
                              .map((a) => (
                                <SelectItem key={a.code} value={a.code}>
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {a.code}
                                  </span>
                                  {a.name}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Method</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {METHOD_LABEL[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder={copy.placeholder} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="transaction_ref"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction reference</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={mutation.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <LoadingButton type="submit" loading={mutation.isPending}>
                Save
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default AddPayment
