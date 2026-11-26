import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Prisma } from '@prisma/client'
import type { Request } from 'express'
import { buildProductListQuery, createProduct, updateCategory } from '../services/catalogue.js'
import {
  addProductBarcodeSchema,
  createCategorySchema,
  createProductSchema,
  listCategoriesSchema,
  listProductsSchema,
  updateCategorySchema,
  updateProductSchema,
} from './catalogue.js'

const validProduct = {
  name: 'Tea',
  baseUnit: 'PIECE',
  isWeighted: false,
  quantityPrecision: 0,
  defaultSellingPrice: '125.50',
  active: true,
  tracksExpiry: false,
}

test('category create requires the confirmed active field', () => {
  assert.equal(createCategorySchema.safeParse({ name: 'Grocery' }).success, false)
  assert.equal(createCategorySchema.safeParse({ name: 'Grocery', active: true }).success, true)
})

test('category update accepts active changes and rejects invalid or empty input', () => {
  assert.deepEqual(updateCategorySchema.parse({ active: false }), { active: false })
  assert.deepEqual(updateCategorySchema.parse({ active: true }), { active: true })
  assert.equal(updateCategorySchema.safeParse({ active: 'false' }).success, false)
  assert.equal(updateCategorySchema.safeParse({ active: null }).success, false)
  assert.equal(updateCategorySchema.safeParse({}).success, false)
})

test('product accepts a nullable or omitted default cost and barcode aliases', () => {
  const parsed = createProductSchema.parse({
    ...validProduct,
    defaultCost: null,
    barcodes: [{ barcode: '0001234567890', type: 'unconfirmed-type' }],
  })
  assert.equal(parsed.defaultCost, null)
  assert.equal(parsed.barcodes?.[0]?.barcode, '0001234567890')
  assert.equal(parsed.barcodes?.[0]?.type, 'unconfirmed-type')
  assert.equal(createProductSchema.parse(validProduct).defaultCost, undefined)
})

test('SKU and barcode inputs trim surrounding whitespace without changing case or format', () => {
  const parsed = createProductSchema.parse({
    ...validProduct,
    sku: ' tea-01 ',
    barcodes: [{ barcode: ' AbC-001 ', type: 'alias' }],
  })
  assert.equal(parsed.sku, 'tea-01')
  assert.equal(parsed.barcodes?.[0]?.barcode, 'AbC-001')
  assert.equal(updateProductSchema.parse({ sku: ' sku-02 ' }).sku, 'sku-02')
  assert.equal(addProductBarcodeSchema.parse({ barcode: ' xYz-03 ', type: 'alias' }).barcode, 'xYz-03')
})

test('SKU and barcode inputs reject whitespace-only values', () => {
  assert.equal(createProductSchema.safeParse({ ...validProduct, sku: '   ' }).success, false)
  assert.equal(updateProductSchema.safeParse({ sku: '   ' }).success, false)
  assert.equal(createProductSchema.safeParse({
    ...validProduct,
    barcodes: [{ barcode: '   ', type: 'alias' }],
  }).success, false)
  assert.equal(addProductBarcodeSchema.safeParse({ barcode: '   ', type: 'alias' }).success, false)
})

test('product monetary values match LKR NUMERIC(12,2) precision', () => {
  assert.equal(createProductSchema.safeParse({ ...validProduct, defaultSellingPrice: '9999999999.99' }).success, true)
  assert.equal(createProductSchema.safeParse({ ...validProduct, defaultSellingPrice: '10000000000.00' }).success, false)
  assert.equal(createProductSchema.safeParse({ ...validProduct, defaultSellingPrice: '1.234' }).success, false)
  assert.equal(createProductSchema.safeParse({ ...validProduct, defaultSellingPrice: '0' }).success, true)
  assert.equal(createProductSchema.safeParse({ ...validProduct, defaultSellingPrice: '-0.01' }).success, false)
  assert.equal(createProductSchema.safeParse({ ...validProduct, defaultCost: '0' }).success, true)
  assert.equal(createProductSchema.safeParse({ ...validProduct, defaultCost: null }).success, true)
  assert.equal(createProductSchema.safeParse({ ...validProduct, defaultCost: '-0.01' }).success, false)
  assert.equal(updateProductSchema.safeParse({ defaultSellingPrice: '0.00' }).success, true)
  assert.equal(updateProductSchema.safeParse({ defaultSellingPrice: '-0.01' }).success, false)
  assert.equal(updateProductSchema.safeParse({ defaultCost: '0.00' }).success, true)
  assert.equal(updateProductSchema.safeParse({ defaultCost: null }).success, true)
  assert.equal(updateProductSchema.safeParse({ defaultCost: '-0.01' }).success, false)
})

test('category listing supports bounded pagination with existing filters', () => {
  assert.deepEqual(listCategoriesSchema.parse({ active: 'false' }), {
    active: false,
    page: 1,
    pageSize: 50,
  })
  assert.equal(listCategoriesSchema.safeParse({ pageSize: '101' }).success, false)
  assert.equal(listCategoriesSchema.safeParse({ page: '1001', pageSize: '100' }).success, true)
  assert.equal(listCategoriesSchema.safeParse({ page: '1002', pageSize: '100' }).success, false)
  assert.equal(listCategoriesSchema.safeParse({ page: '100001', pageSize: '1' }).success, true)
  assert.equal(listCategoriesSchema.safeParse({ page: '100002', pageSize: '1' }).success, false)
})

test('create and update accept quantity precision boundaries 0 and 3', () => {
  for (const quantityPrecision of [0, 3]) {
    assert.equal(createProductSchema.safeParse({ ...validProduct, quantityPrecision }).success, true)
    assert.equal(updateProductSchema.safeParse({ quantityPrecision }).success, true)
  }
})

test('create and update reject quantity precision outside 0 through 3', () => {
  for (const quantityPrecision of [-1, 4]) {
    assert.equal(createProductSchema.safeParse({ ...validProduct, quantityPrecision }).success, false)
    assert.equal(updateProductSchema.safeParse({ quantityPrecision }).success, false)
  }
})

test('list filters parse booleans and apply bounded pagination defaults', () => {
  assert.deepEqual(listProductsSchema.parse({ active: 'false' }), {
    active: false,
    page: 1,
    pageSize: 50,
  })
  assert.equal(listProductsSchema.safeParse({ pageSize: '101' }).success, false)
  assert.equal(listProductsSchema.safeParse({ page: '1001', pageSize: '100' }).success, true)
  assert.equal(listProductsSchema.safeParse({ page: '1002', pageSize: '100' }).success, false)
  assert.equal(listProductsSchema.safeParse({ page: '100002', pageSize: '1' }).success, false)
})

test('product listing uses ID as a deterministic tie-breaker after name', () => {
  const query = buildProductListQuery(listProductsSchema.parse({}))
  assert.deepEqual(query.orderBy, [{ name: 'asc' }, { id: 'asc' }])
})

test('update schemas reject empty updates', () => {
  assert.equal(updateProductSchema.safeParse({}).success, false)
  assert.equal(updateCategorySchema.safeParse({}).success, false)
})

test('category can be deactivated and reactivated with an audit in the same transaction', async () => {
  const now = new Date('2026-11-13T00:00:00.000Z')
  const category = {
    id: 'category-1',
    name: 'Grocery',
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  const auditEntries: Array<{
    action: string
    entity: string
    requestId: string
    actorId?: string
    entityId?: string
    ipAddress?: string
    metadata?: unknown
  }> = []
  const updatedFields: Array<{ active?: boolean }> = []
  const transactionClient = {
    category: {
      update: async ({ where, data }: {
        where: { id: string }
        data: { active?: boolean; name?: string }
      }) => {
        assert.equal(where.id, category.id)
        updatedFields.push(data)
        if (data.active !== undefined) category.active = data.active
        if (data.name !== undefined) category.name = data.name
        return { ...category }
      },
    },
    auditLog: {
      create: async ({ data }: {
        data: {
          action: string
          entity: string
          requestId: string
          actorId?: string
          entityId?: string
          ipAddress?: string
          metadata?: unknown
        }
      }) => {
        auditEntries.push(data)
        return data
      },
    },
  }
  let transactionCount = 0
  const transactionRunner = async <T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) => {
    transactionCount += 1
    return operation(transactionClient as never)
  }
  const request = {
    id: 'request-1',
    auth: { userId: 'owner-1', memberships: [] },
    ip: '127.0.0.1',
  } as unknown as Request

  const deactivated = await updateCategory(
    request,
    category.id,
    updateCategorySchema.parse({ active: false }),
    transactionRunner,
  )
  const reactivated = await updateCategory(
    request,
    category.id,
    updateCategorySchema.parse({ active: true }),
    transactionRunner,
  )

  assert.equal(deactivated.active, false)
  assert.equal(reactivated.active, true)
  assert.equal(transactionCount, 2)
  assert.deepEqual(updatedFields, [{ active: false }, { active: true }])
  assert.deepEqual(auditEntries, [
    {
      action: 'CATEGORY_UPDATED',
      entity: 'Category',
      requestId: 'request-1',
      actorId: 'owner-1',
      entityId: category.id,
      ipAddress: '127.0.0.1',
      metadata: { changedFields: ['active'] },
    },
    {
      action: 'CATEGORY_UPDATED',
      entity: 'Category',
      requestId: 'request-1',
      actorId: 'owner-1',
      entityId: category.id,
      ipAddress: '127.0.0.1',
      metadata: { changedFields: ['active'] },
    },
  ])
})

test('product, barcode aliases, and audit writes share the Prisma transaction client', async () => {
  const events: string[] = []
  const now = new Date('2026-11-13T00:00:00.000Z')
  const barcodes: Array<{ id: string; productId: string; barcode: string; type: string; createdAt: Date }> = []
  const product = {
    id: 'product-1',
    sku: null,
    name: 'Tea',
    categoryId: null,
    baseUnit: 'PIECE' as const,
    isWeighted: false,
    quantityPrecision: 0,
    defaultCost: null,
    defaultSellingPrice: new Prisma.Decimal('125.50'),
    active: true,
    tracksExpiry: false,
    createdAt: now,
    updatedAt: now,
  }
  const transactionClient = {
    product: {
      create: async () => { events.push('product:create'); return product },
      findUniqueOrThrow: async () => ({ ...product, barcodes }),
    },
    productBarcode: {
      create: async ({ data }: { data: { productId: string; barcode: string; type: string } }) => {
        const created = { id: `barcode-${barcodes.length + 1}`, ...data, createdAt: now }
        barcodes.push(created)
        events.push('barcode:create')
        return created
      },
    },
    auditLog: {
      create: async ({ data }: { data: { action: string } }) => {
        events.push(`audit:${data.action}`)
        return data
      },
    },
  }
  let transactionCount = 0
  const transactionRunner = async <T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) => {
    transactionCount += 1
    return operation(transactionClient as never)
  }

  const request = {
    id: 'request-1',
    auth: { userId: 'owner-1', memberships: [] },
    ip: '127.0.0.1',
  } as unknown as Request
  const created = await createProduct(request, createProductSchema.parse({
    ...validProduct,
    barcodes: [
      { barcode: '0001234567890', type: 'primary' },
      { barcode: '0001234567891', type: 'alias' },
    ],
  }), transactionRunner)

  assert.equal(transactionCount, 1)
  assert.equal(created.barcodes.length, 2)
  assert.deepEqual(events, [
    'product:create',
    'audit:PRODUCT_CREATED',
    'barcode:create',
    'audit:PRODUCT_BARCODE_ADDED',
    'barcode:create',
    'audit:PRODUCT_BARCODE_ADDED',
  ])
})