import { Router } from 'express'
import type { ShopListDto } from '../../../shared/api.js'
import { requireAuth, requireShopMembership } from '../middleware/authorization.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.use(requireAuth)

router.get('/', async (request, response) => {
  const shops = await prisma.shop.findMany({
    where: { active: true, memberships: { some: { userId: request.auth!.userId } } },
    select: { id: true, code: true, name: true, memberships: { where: { userId: request.auth!.userId }, select: { role: true } } },
    orderBy: { code: 'asc' },
  })
  const result: ShopListDto = {
    shops: shops.map(({ memberships, ...shop }) => ({ ...shop, role: memberships[0]!.role })),
  }
  response.json(result)
})

router.get('/:shopId', requireShopMembership, async (request, response) => {
  const shop = await prisma.shop.findUniqueOrThrow({
    where: { id: request.shopMembership!.shopId },
    select: { id: true, code: true, name: true },
  })
  response.json({ shop, role: request.shopMembership!.role })
})

export default router