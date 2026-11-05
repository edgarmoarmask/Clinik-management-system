import {
  AccountingService,
  CartService,
  type PaymentMethod,
  type PaymentStatus,
  PaymentsService,
  ProductsService,
} from "@/client"

export function productsQueryOptions(search: string) {
  return {
    queryKey: ["products", { search }],
    queryFn: async () =>
      (
        await ProductsService.listProducts({
          query: { q: search || undefined, limit: 100 },
        })
      ).data,
  }
}

export function cartQueryOptions() {
  return {
    queryKey: ["cart"],
    queryFn: async () => (await CartService.viewCart()).data,
  }
}

export function paymentsQueryOptions() {
  return {
    queryKey: ["payments"],
    queryFn: async () =>
      (await PaymentsService.listPayments({ query: { limit: 500 } })).data,
  }
}

export function paymentsSummaryQueryOptions() {
  return {
    queryKey: ["payments", "summary"],
    queryFn: async () => (await PaymentsService.paymentsSummary()).data,
  }
}

export function accountsQueryOptions() {
  return {
    queryKey: ["accounts"],
    queryFn: async () => (await AccountingService.listAccounts()).data,
    staleTime: Number.POSITIVE_INFINITY, // the chart of accounts is static
  }
}

export function profitAndLossQueryOptions(range: { start?: Date; end?: Date }) {
  return {
    queryKey: ["payments", "profit-and-loss", range],
    queryFn: async () =>
      (
        await AccountingService.profitAndLoss({
          query: {
            start: range.start?.toISOString(),
            end: range.end?.toISOString(),
          },
        })
      ).data,
  }
}

// The API sends Decimal fields (price, amount, totals) as strings.
// Amounts are Malaysian ringgit, matching the chart of accounts.
export function formatMoney(value: string | number) {
  return Number(value).toLocaleString("en-MY", {
    style: "currency",
    currency: "MYR",
  })
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "cash",
  "card",
  "bank_transfer",
  "ewallet",
]

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  ewallet: "E-wallet",
}

export const STATUS_VARIANT: Record<
  PaymentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  paid: "default",
  pending: "secondary",
  failed: "destructive",
  cancelled: "outline",
}
