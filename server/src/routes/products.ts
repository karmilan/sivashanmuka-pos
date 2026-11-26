import { Router } from 'express'
import { requireAuth, requireCatalogueMembership, requireOwner } from '../middleware/authorization.js'
import {
  addProductBarcode,
  createProduct,
  getProduct,
  listProducts,
  updateProduct,
} from '../services/catalogue.js'
import {
  addProductBarcodeSchema,
  createProductSchema,
  listProductsSchema,
  productIdParamsSchema,
  updateProductSchema,
} from '../validation/catalogue.js'

const router = Router()

router.use(requireAuth, requireCatalogueMembership)

router.get('/', async (request, response) => {
  const query = listProductsSchema.parse(request.query)
  response.json(await listProducts(query))
})

router.get('/:productId', async (request, response) => {
  const { productId } = productIdParamsSchema.parse(request.params)
  response.json({ product: await getProduct(productId) })
})

router.post('/', requireOwner, async (request, response) => {
  const input = createProductSchema.parse(request.body)
  response.status(201).json({ product: await createProduct(request, input) })
})

router.patch('/:productId', requireOwner, async (request, response) => {
  const { productId } = productIdParamsSchema.parse(request.params)
  const input = updateProductSchema.parse(request.body)
  response.json({ product: await updateProduct(request, productId, input) })
})

router.post('/:productId/barcodes', requireOwner, async (request, response) => {
  const { productId } = productIdParamsSchema.parse(request.params)
  const input = addProductBarcodeSchema.parse(request.body)
  response.status(201).json({ barcode: await addProductBarcode(request, productId, input) })
})

export default router