import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Download, Upload } from "lucide-react"
import { useState } from "react"

import { type ProductCreate, ProductsService } from "@/client"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { parseCsv } from "@/lib/csv"
import { handleError } from "@/utils"

const COLUMNS = [
  "sku",
  "name",
  "generic_name",
  "description",
  "dosage_form",
  "strength",
  "manufacturer",
  "price",
  "stock",
  "requires_prescription",
  "expiry_date",
] as const
const REQUIRED = ["sku", "name", "price"] as const
const OPTIONAL_TEXT = [
  "generic_name",
  "description",
  "dosage_form",
  "strength",
  "manufacturer",
] as const
// Matches the backend's BATCH_LIMIT
const MAX_ROWS = 1000
const MAX_ERRORS_SHOWN = 8

const TEMPLATE = `${COLUMNS.join(",")}
PARA-500,Paracetamol,Acetaminophen,Pain and fever relief,tablet,500 mg,Acme Pharma,2.50,100,no,2027-12-31
AMOX-250,Amoxicillin,,,capsule,250 mg,,8.00,40,yes,
`

const BOOLEANS: Record<string, boolean> = {
  "": false,
  true: true,
  yes: true,
  y: true,
  "1": true,
  false: false,
  no: false,
  n: false,
  "0": false,
}

type Parsed = { products: ProductCreate[]; errors: string[] }

function toProducts(text: string): Parsed {
  const [header, ...rows] = parseCsv(text)
  if (!header) return { products: [], errors: ["The file is empty"] }

  const index = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]))
  const missing = REQUIRED.filter((c) => !index.has(c))
  if (missing.length) {
    return {
      products: [],
      errors: [`Missing column(s): ${missing.join(", ")}`],
    }
  }
  if (rows.length === 0) return { products: [], errors: ["No product rows"] }
  if (rows.length > MAX_ROWS) {
    return {
      products: [],
      errors: [`Too many rows (${rows.length}); the limit is ${MAX_ROWS}`],
    }
  }

  const products: ProductCreate[] = []
  const errors: string[] = []
  rows.forEach((row, i) => {
    const line = i + 2 // header is line 1
    const get = (col: (typeof COLUMNS)[number]) => {
      const at = index.get(col)
      return at === undefined ? "" : (row[at] ?? "").trim()
    }
    const rowErrors: string[] = []

    const sku = get("sku")
    const name = get("name")
    if (!sku) rowErrors.push("sku is required")
    if (!name) rowErrors.push("name is required")

    const price = get("price")
    if (!(Number(price) > 0)) rowErrors.push(`invalid price "${price}"`)

    const stockText = get("stock") || "0"
    const stock = Number(stockText)
    if (!Number.isInteger(stock) || stock < 0) {
      rowErrors.push(`invalid stock "${stockText}"`)
    }

    const rx = get("requires_prescription").toLowerCase()
    if (!(rx in BOOLEANS)) {
      rowErrors.push(`requires_prescription must be yes/no, got "${rx}"`)
    }

    const expiry = get("expiry_date")
    if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      rowErrors.push(`expiry_date must be YYYY-MM-DD, got "${expiry}"`)
    }

    if (rowErrors.length) {
      errors.push(`Line ${line}: ${rowErrors.join("; ")}`)
      return
    }
    const product: ProductCreate = {
      sku,
      name,
      price,
      stock,
      requires_prescription: BOOLEANS[rx],
      expiry_date: expiry || null,
    }
    for (const col of OPTIONAL_TEXT) product[col] = get(col) || null
    products.push(product)
  })
  return { products, errors }
}

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }))
  const a = document.createElement("a")
  a.href = url
  a.download = "products-template.csv"
  a.click()
  URL.revokeObjectURL(url)
}

const ImportProducts = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const onOpenChange = (open: boolean) => {
    if (!open) setParsed(null)
    setIsOpen(open)
  }

  const onFile = async (file: File | undefined) => {
    setParsed(file ? toProducts(await file.text()) : null)
  }

  const mutation = useMutation({
    mutationFn: (products: ProductCreate[]) =>
      ProductsService.createProductsBatch({ body: products }),
    onSuccess: (res) => {
      showSuccessToast(`${res.data.length} products imported`)
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })

  const ready = parsed && parsed.errors.length === 0 ? parsed.products : null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
          <DialogDescription>
            Upload a CSV file with one product per row. Required columns: sku,
            name, price. If any row is invalid or any SKU already exists,
            nothing is imported.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <Button
            type="button"
            variant="link"
            className="h-auto justify-start p-0"
            onClick={downloadTemplate}
          >
            <Download />
            Download CSV template
          </Button>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onFile(e.target.files?.[0])}
          />

          {parsed && parsed.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <p className="font-medium">
                  Fix {parsed.errors.length}{" "}
                  {parsed.errors.length === 1 ? "problem" : "problems"} and
                  upload again:
                </p>
                <ul className="list-disc pl-4">
                  {parsed.errors.slice(0, MAX_ERRORS_SHOWN).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                  {parsed.errors.length > MAX_ERRORS_SHOWN && (
                    <li>…and {parsed.errors.length - MAX_ERRORS_SHOWN} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {ready && (
            <p className="text-sm text-muted-foreground">
              {ready.length} {ready.length === 1 ? "product" : "products"} ready
              to import.
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={mutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <LoadingButton
            loading={mutation.isPending}
            disabled={!ready}
            onClick={() => ready && mutation.mutate(ready)}
          >
            Import {ready ? ready.length : ""}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ImportProducts
