import type { RequestHandler } from 'express'
import { Role } from '@prisma/client'
import { hasRole } from '../auth/access.js'
import { prisma } from '../lib/prisma.js'
import { ApiError } from '../lib/errors.js'

export const requireAuth: RequestHandler = async (request, _response, next) => {
  const userId = request.session.userId
  if (!userId) return next(new ApiError(401, 'UNAUTHENTICATED', 'Sign in is required.'))

  const user = await prisma.user.findFirst({
    where: { id: userId, active: true },
    select: { id: true, memberships: { where: { shop: { active: true } }, select: { shopId: true, role: true } } },
  })
  if (!user) return next(new ApiError(401, 'UNAUTHENTICATED', 'Sign in is required.'))

  request.auth = { userId: user.id, memberships: user.memberships }
  return next()
}

export const requireOwner: RequestHandler = (request, _response, next) => {
  if (!request.auth || !hasRole(request.auth.memberships, [Role.OWNER])) {
    return next(new ApiError(403, 'FORBIDDEN', 'Owner access is required.'))
  }
  return next()
}

export const requireShopMembership: RequestHandler = async (request, _response, next) => {
  if (!request.auth) return next(new ApiError(401, 'UNAUTHENTICATED', 'Sign in is required.'))
  const shopId = request.get('x-shop-id')
  if (!shopId) return next(new ApiError(400, 'SHOP_CONTEXT_REQUIRED', 'Select an authorized shop.'))
  if (request.params.shopId && request.params.shopId !== shopId) {
    return next(new ApiError(403, 'SHOP_FORBIDDEN', 'The requested shop does not match the authorized context.'))
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: request.auth.userId, shopId, shop: { active: true } },
    select: { shopId: true, role: true },
  })
  if (!membership) return next(new ApiError(403, 'SHOP_FORBIDDEN', 'You are not assigned to this shop.'))
  request.shopMembership = membership
  return next()
}