import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type ProductRead, ProductsService } from "@/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
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
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const formSchema = z.object({
  sku: z.string().min(1, { message: "SKU is required" }).max(50),
  name: z.string().min(1, { message: "Name is required" }).max(200),
  generic_name: z.string().max(200).optional(),
  strength: z.string().max(50).optional(),
  price: z.string().refine((v) => Number(v) > 0, {
    message: "Price must be greater than 0",
  }),
  stock: z
    .string()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0, {
      message: "Stock must be a whole number",
    }),
  requires_prescription: z.boolean(),
  expiry_date: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

const TEXT_FIELDS = [
  { name: "sku", label: "SKU", required: true },
  { name: "name", label: "Name", required: true },
  { name: "generic_name", label: "Generic name" },
  { name: "strength", label: "Strength", placeholder: "e.g. 500 mg" },
] as const

const toFormValues = (product?: ProductRead): FormData => ({
  sku: product?.sku ?? "",
  name: product?.name ?? "",
  generic_name: product?.generic_name ?? "",
  strength: product?.strength ?? "",
  price: product?.price ?? "",
  stock: String(product?.stock ?? 0),
  requires_prescription: product?.requires_prescription ?? false,
  expiry_date: product?.expiry_date ?? "",
})

interface ProductDialogProps {
  // When given, the dialog edits this product; otherwise it creates one.
  product?: ProductRead
  onSuccess?: () => void
}

const ProductDialog = ({ product, onSuccess }: ProductDialogProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const isEdit = product !== undefined

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: toFormValues(product),
  })

  const onOpenChange = (open: boolean) => {
    // load the latest values each time the edit dialog opens
    if (open) form.reset(toFormValues(product))
    setIsOpen(open)
  }

  const mutation = useMutation({
    mutationFn: ({ sku, ...data }: FormData) => {
      const body = {
        ...data,
        stock: Number(data.stock),
        generic_name: data.generic_name || null,
        strength: data.strength || null,
        expiry_date: data.expiry_date || null,
      }
      return isEdit
        ? ProductsService.updateProduct({
            path: { product_id: product.id },
            body,
          })
        : ProductsService.createProduct({ body: { ...body, sku } })
    },
    onSuccess: () => {
      showSuccessToast(
        isEdit
          ? "Product updated successfully"
          : "Product created successfully",
      )
      form.reset()
      setIsOpen(false)
      onSuccess?.()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {isEdit ? (
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          onClick={() => onOpenChange(true)}
        >
          <Pencil />
          Edit Product
        </DropdownMenuItem>
      ) : (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2" />
            Add Product
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Add Product"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the product details. The SKU cannot be changed."
              : "Fill in the details to add a product to the catalogue."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
            <div className="grid gap-4 py-4">
              {TEXT_FIELDS.map((f) => (
                <FormField
                  key={f.name}
                  control={form.control}
                  name={f.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {f.label}
                        {"required" in f && (
                          <span className="text-destructive">*</span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={"placeholder" in f ? f.placeholder : ""}
                          disabled={isEdit && f.name === "sku"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Price <span className="text-destructive">*</span>
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
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="expiry_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="requires_prescription"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Requires prescription
                    </FormLabel>
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

export default ProductDialog
