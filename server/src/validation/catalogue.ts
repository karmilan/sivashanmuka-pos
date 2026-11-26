import { z } from 'zod'

export const productUnitSchema = z.enum([
  'PIECE',
  'KILOGRAM',
  'GRAM',
  'LITRE',
  'MILLILITRE',
  'PACKET',
  'BOX',
])

const uuidSchema = z.uuid()
const nameSchema = z.string().trim().min(1)
const optionalSkuSchema = z.string().trim().min(1).nullable().optional()
const optionalCategoryIdSchema = uuidSchema.nullable().optional()
const monetaryValueSchema = z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/)
const quantityPrecisionSchema = z.number().int().min(0).max(3)
const maxListOffset = 100_000
const barcodeInputSchema = z.object({
  barcode: z.string().trim().min(1),
  type: z.string().min(1),
})
const booleanQuerySchema = z.enum(['true', 'false']).transform((value) => value === 'true')
const pageSchema = z.coerce.number().int().min(1).max(maxListOffset + 1).default(1)
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(50)

function isWithinListOffset({ page, pageSize }: { page: number; pageSize: number }): boolean {
  return (page - 1) * pageSize <= maxListOffset
}

export const createCategorySchema = z.object({
  name: nameSchema,
  active: z.boolean(),
})

export const updateCategorySchema = z.object({
  name: nameSchema.optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required.')

export const listCategoriesSchema = z.object({
  active: booleanQuerySchema.optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
}).refine(isWithinListOffset, {
  message: 'The requested category page exceeds the maximum offset.',
  path: ['page'],
})

export const categoryIdParamsSchema = z.object({ categoryId: uuidSchema })

export const createProductSchema = z.object({
  sku: optionalSkuSchema,
  name: nameSchema,
  categoryId: optionalCategoryIdSchema,
  baseUnit: productUnitSchema,
  isWeighted: z.boolean(),
  quantityPrecision: quantityPrecisionSchema,
  defaultCost: monetaryValueSchema.nullable().optional(),
  defaultSellingPrice: monetaryValueSchema,
  active: z.boolean(),
  tracksExpiry: z.boolean(),
  barcodes: z.array(barcodeInputSchema).optional(),
})

export const updateProductSchema = z.object({
  sku: optionalSkuSchema,
  name: nameSchema.optional(),
  categoryId: optionalCategoryIdSchema,
  baseUnit: productUnitSchema.optional(),
  isWeighted: z.boolean().optional(),
  quantityPrecision: quantityPrecisionSchema.optional(),
  defaultCost: monetaryValueSchema.nullable().optional(),
  defaultSellingPrice: monetaryValueSchema.optional(),
  active: z.boolean().optional(),
  tracksExpiry: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required.')

export const listProductsSchema = z.object({
  q: z.string().optional(),
  categoryId: uuidSchema.optional(),
  active: booleanQuerySchema.optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
}).refine(isWithinListOffset, {
  message: 'The requested product page exceeds the maximum offset.',
  path: ['page'],
})

export const productIdParamsSchema = z.object({ productId: uuidSchema })

export const addProductBarcodeSchema = barcodeInputSchema