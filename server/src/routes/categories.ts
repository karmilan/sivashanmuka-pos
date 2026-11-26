import { Router } from 'express'
import { requireAuth, requireCatalogueMembership, requireOwner } from '../middleware/authorization.js'
import {
  createCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../services/catalogue.js'
import {
  categoryIdParamsSchema,
  createCategorySchema,
  listCategoriesSchema,
  updateCategorySchema,
} from '../validation/catalogue.js'

const router = Router()

router.use(requireAuth, requireCatalogueMembership)

router.get('/', async (request, response) => {
  const query = listCategoriesSchema.parse(request.query)
  response.json(await listCategories(query))
})

router.get('/:categoryId', async (request, response) => {
  const { categoryId } = categoryIdParamsSchema.parse(request.params)
  response.json({ category: await getCategory(categoryId) })
})

router.post('/', requireOwner, async (request, response) => {
  const input = createCategorySchema.parse(request.body)
  response.status(201).json({ category: await createCategory(request, input) })
})

router.patch('/:categoryId', requireOwner, async (request, response) => {
  const { categoryId } = categoryIdParamsSchema.parse(request.params)
  const input = updateCategorySchema.parse(request.body)
  response.json({ category: await updateCategory(request, categoryId, input) })
})

export default router