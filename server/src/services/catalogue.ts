import { Prisma } from '@prisma/client'
import type { CategoryDto, CategoryListDto, ProductBarcodeDto, ProductDto, ProductListDto } from '../../../shared/api.js'
import type { Request } from 'express'
import type { z } from 'zod'
import {
  addProductBarcodeSchema,
  createCategorySchema,
  createProductSchema,
  listCategoriesSchema,
  listProductsSchema,
  updateCategorySchema,
  updateProductSchema,
} from '../validation/catalogue.js'
import { writeAudit } from '../lib/audit.js'
import { ApiError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'

const productInclude = {
  barcodes: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ProductInclude

type ProductWithBarcodes = Prisma.ProductGetPayload<{ include: typeof productInclude }>
type CreateCategoryInput = z.infer<typeof createCategorySchema>
type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
type CreateProductInput = z.infer<typeof createProductSchema>
type UpdateProductInput = z.infer<typeof updateProductSchema>
type BarcodeInput = z.infer<typeof addProductBarcodeSchema>
type CategoryListQuery = z.infer<typeof listCategoriesSchema>
type ProductListQuery = z.infer<typeof listProductsSchema>
type CategoryTransactionRunner = <T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>
type ProductTransactionRunner = <T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>

function categoryDto(category: {
  id: string
  name: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    active: category.active,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  }
}

function barcodeDto(barcode: ProductWithBarcodes['barcodes'][number]): ProductBarcodeDto {
  return {
    id: barcode.id,
    productId: barcode.productId,
    barcode: barcode.barcode,
    type: barcode.type,
    createdAt: barcode.createdAt.toISOString(),
  }
}

function productDto(product: ProductWithBarcodes): ProductDto {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    categoryId: product.categoryId,
    baseUnit: product.baseUnit,
    isWeighted: product.isWeighted,
    quantityPrecision: product.quantityPrecision,
    defaultCost: product.defaultCost?.toFixed(2) ?? null,
    defaultSellingPrice: product.defaultSellingPrice.toFixed(2),
    active: product.active,
    tracksExpiry: product.tracksExpiry,
    barcodes: product.barcodes.map(barcodeDto),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}

function translateCatalogueError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = error.meta?.target
      const fields = Array.isArray(target) ? target.join(',') : String(target ?? '')
      if (fields.includes('sku')) {
        throw new ApiError(409, 'SKU_CONFLICT', 'A product with this SKU already exists.')
      }
      if (fields.includes('barcode')) {
        throw new ApiError(409, 'BARCODE_CONFLICT', 'This barcode is already assigned.')
      }
      throw new ApiError(409, 'CATALOGUE_CONFLICT', 'The catalogue record conflicts with an existing value.')
    }
    if (error.code === 'P2025') {
      throw new ApiError(404, 'CATALOGUE_RECORD_NOT_FOUND', 'The catalogue record was not found.')
    }
  }
  throw error
}

async function requireCategory(categoryId: string): Promise<void> {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } })
  if (!category) throw new ApiError(400, 'INVALID_CATEGORY', 'The selected category was not found.')
}

export async function listCategories(query: CategoryListQuery): Promise<CategoryListDto> {
  const where: Prisma.CategoryWhereInput = {
    ...(query.active !== undefined && { active: query.active }),
  }
  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.category.count({ where }),
  ])
  return {
    categories: categories.map(categoryDto),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getCategory(categoryId: string): Promise<CategoryDto> {
  const category = await prisma.category.findUnique({ where: { id: categoryId } })
  if (!category) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'The category was not found.')
  return categoryDto(category)
}

export async function createCategory(request: Request, input: CreateCategoryInput): Promise<CategoryDto> {
  try {
    const category = await prisma.$transaction(async (transaction) => {
      const created = await transaction.category.create({ data: input })
      await writeAudit(request, {
        action: 'CATEGORY_CREATED',
        entity: 'Category',
        entityId: created.id,
        metadata: { active: created.active },
      }, transaction)
      return created
    })
    return categoryDto(category)
  } catch (error) {
    translateCatalogueError(error)
  }
}

export async function updateCategory(
  request: Request,
  categoryId: string,
  input: UpdateCategoryInput,
  transactionRunner: CategoryTransactionRunner = (operation) => prisma.$transaction(operation),
): Promise<CategoryDto> {
  try {
    const category = await transactionRunner(async (transaction) => {
      const updated = await transaction.category.update({
        where: { id: categoryId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.active !== undefined && { active: input.active }),
        },
      })
      await writeAudit(request, {
        action: 'CATEGORY_UPDATED',
        entity: 'Category',
        entityId: updated.id,
        metadata: { changedFields: Object.keys(input) },
      }, transaction)
      return updated
    })
    return categoryDto(category)
  } catch (error) {
    translateCatalogueError(error)
  }
}

export function buildProductListQuery(query: ProductListQuery) {
  const where: Prisma.ProductWhereInput = {
    ...(query.active !== undefined && { active: query.active }),
    ...(query.categoryId !== undefined && { categoryId: query.categoryId }),
    ...(query.q && {
      OR: [
        { name: { contains: query.q } },
        { sku: { contains: query.q } },
        { barcodes: { some: { barcode: { contains: query.q } } } },
      ],
    }),
  }
  return {
    where,
    include: productInclude,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  } satisfies Prisma.ProductFindManyArgs
}

export async function listProducts(query: ProductListQuery): Promise<ProductListDto> {
  const productQuery = buildProductListQuery(query)
  const [products, total] = await Promise.all([
    prisma.product.findMany(productQuery),
    prisma.product.count({ where: productQuery.where }),
  ])
  return {
    products: products.map(productDto),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getProduct(productId: string): Promise<ProductDto> {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: productInclude })
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'The product was not found.')
  return productDto(product)
}

export async function createProduct(
  request: Request,
  input: CreateProductInput,
  transactionRunner: ProductTransactionRunner = (operation) => prisma.$transaction(operation),
): Promise<ProductDto> {
  if (input.categoryId) await requireCategory(input.categoryId)

  try {
    const product = await transactionRunner(async (transaction) => {
      const created = await transaction.product.create({
        data: {
          ...(input.sku !== undefined && { sku: input.sku }),
          name: input.name,
          categoryId: input.categoryId ?? null,
          baseUnit: input.baseUnit,
          isWeighted: input.isWeighted,
          quantityPrecision: input.quantityPrecision,
          defaultCost: input.defaultCost == null ? null : new Prisma.Decimal(input.defaultCost),
          defaultSellingPrice: new Prisma.Decimal(input.defaultSellingPrice),
          active: input.active,
          tracksExpiry: input.tracksExpiry,
        },
      })
      await writeAudit(request, {
        action: 'PRODUCT_CREATED',
        entity: 'Product',
        entityId: created.id,
        metadata: { changedFields: Object.keys(input), barcodeCount: input.barcodes?.length ?? 0 },
      }, transaction)
      for (const alias of input.barcodes ?? []) {
        const barcode = await transaction.productBarcode.create({
          data: { productId: created.id, barcode: alias.barcode, type: alias.type },
        })
        await writeAudit(request, {
          action: 'PRODUCT_BARCODE_ADDED',
          entity: 'ProductBarcode',
          entityId: barcode.id,
          metadata: { productId: created.id, type: barcode.type },
        }, transaction)
      }
      return transaction.product.findUniqueOrThrow({ where: { id: created.id }, include: productInclude })
    })
    return productDto(product)
  } catch (error) {
    translateCatalogueError(error)
  }
}

export async function updateProduct(
  request: Request,
  productId: string,
  input: UpdateProductInput,
): Promise<ProductDto> {
  if (input.categoryId) await requireCategory(input.categoryId)

  try {
    const product = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.product.update({
        where: { id: productId },
        data: {
          ...(input.sku !== undefined && { sku: input.sku }),
          ...(input.name !== undefined && { name: input.name }),
          ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
          ...(input.baseUnit !== undefined && { baseUnit: input.baseUnit }),
          ...(input.isWeighted !== undefined && { isWeighted: input.isWeighted }),
          ...(input.quantityPrecision !== undefined && { quantityPrecision: input.quantityPrecision }),
          ...(input.defaultCost !== undefined && {
            defaultCost: input.defaultCost === null ? null : new Prisma.Decimal(input.defaultCost),
          }),
          ...(input.defaultSellingPrice !== undefined && {
            defaultSellingPrice: new Prisma.Decimal(input.defaultSellingPrice),
          }),
          ...(input.active !== undefined && { active: input.active }),
          ...(input.tracksExpiry !== undefined && { tracksExpiry: input.tracksExpiry }),
        },
        include: productInclude,
      })
      await writeAudit(request, {
        action: 'PRODUCT_UPDATED',
        entity: 'Product',
        entityId: updated.id,
        metadata: { changedFields: Object.keys(input) },
      }, transaction)
      return updated
    })
    return productDto(product)
  } catch (error) {
    translateCatalogueError(error)
  }
}

export async function addProductBarcode(
  request: Request,
  productId: string,
  input: BarcodeInput,
): Promise<ProductBarcodeDto> {
  try {
    const barcode = await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.findUnique({ where: { id: productId }, select: { id: true } })
      if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'The product was not found.')
      const created = await transaction.productBarcode.create({
        data: { productId, barcode: input.barcode, type: input.type },
      })
      await writeAudit(request, {
        action: 'PRODUCT_BARCODE_ADDED',
        entity: 'ProductBarcode',
        entityId: created.id,
        metadata: { productId, type: created.type },
      }, transaction)
      return created
    })
    return {
      id: barcode.id,
      productId: barcode.productId,
      barcode: barcode.barcode,
      type: barcode.type,
      createdAt: barcode.createdAt.toISOString(),
    }
  } catch (error) {
    translateCatalogueError(error)
  }
}