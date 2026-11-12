import bcrypt from 'bcryptjs'
import { Prisma, Role } from '@prisma/client'
import { Router } from 'express'
import type { UserDto, UserListDto } from '../../../shared/api.js'
import { createUserSchema, updateUserSchema } from '../auth/schemas.js'
import { requireAuth, requireOwner } from '../middleware/authorization.js'
import { writeAudit } from '../lib/audit.js'
import { ApiError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
const membershipsInclude = {
  memberships: { include: { shop: { select: { name: true } } }, orderBy: { shopId: 'asc' } },
} satisfies Prisma.UserInclude
type UserWithMemberships = Prisma.UserGetPayload<{ include: typeof membershipsInclude }>
type UserDtoSource = Pick<UserWithMemberships, 'id' | 'email' | 'name' | 'active' | 'memberships'>

function userDto(user: UserDtoSource): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    active: user.active,
    memberships: user.memberships.map(({ shopId, role, shop }) => ({ shopId, shopName: shop.name, role })),
  }
}

async function validateMemberships(memberships: Array<{ shopId: string; role: Role }>): Promise<void> {
  const activeShops = await prisma.shop.findMany({ where: { active: true }, select: { id: true } })
  const selectedShops = await prisma.shop.findMany({
    where: { id: { in: memberships.map(({ shopId }) => shopId) }, active: true },
    select: { id: true },
  })
  if (selectedShops.length !== memberships.length) {
    throw new ApiError(400, 'INVALID_SHOP', 'One or more selected shops are unavailable.')
  }
  if (memberships.some(({ role }) => role === Role.OWNER)
    && (memberships.length !== activeShops.length || memberships.some(({ role }) => role !== Role.OWNER))) {
    throw new ApiError(400, 'OWNER_ALL_SHOPS_REQUIRED', 'Owner access must be assigned to every active shop.')
  }
}

router.use(requireAuth, requireOwner)

router.get('/', async (_request, response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      active: true,
      memberships: { include: { shop: { select: { name: true } } }, orderBy: { shopId: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })
  const result: UserListDto = { users: users.map(userDto) }
  response.json(result)
})

router.post('/', async (request, response) => {
  const input = createUserSchema.parse(request.body)
  await validateMemberships(input.memberships)

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: await bcrypt.hash(input.password, 12),
          memberships: { create: input.memberships.map(({ shopId, role }) => ({ shopId, role })) },
        },
        include: membershipsInclude,
      })
      await writeAudit(request, {
        action: 'USER_CREATED',
        entity: 'User',
        entityId: created.id,
        metadata: { membershipCount: created.memberships.length },
      }, transaction)
      return created
    })
    response.status(201).json({ user: userDto(user) })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ApiError(409, 'EMAIL_CONFLICT', 'An account with this email already exists.')
    }
    throw error
  }
})

router.patch('/:userId', async (request, response) => {
  const input = updateUserSchema.parse(request.body)
  if (request.params.userId === request.auth!.userId && input.active === false) {
    throw new ApiError(409, 'SELF_DEACTIVATION_BLOCKED', 'You cannot deactivate your own account.')
  }
  if (input.memberships) {
    await validateMemberships(input.memberships)
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const previous = await transaction.user.findUnique({
      where: { id: request.params.userId },
      select: { id: true, active: true, memberships: { select: { role: true } } },
    })
    if (!previous) throw new ApiError(404, 'USER_NOT_FOUND', 'User was not found.')
    const losesLastOwner = previous.active
      && previous.memberships.some(({ role }) => role === Role.OWNER)
      && (input.active === false || input.memberships?.every(({ role }) => role !== Role.OWNER))
    if (losesLastOwner) {
      const activeOwners = await transaction.user.count({ where: { active: true, memberships: { some: { role: Role.OWNER } } } })
      if (activeOwners <= 1) throw new ApiError(409, 'LAST_OWNER_REQUIRED', 'At least one active owner must remain.')
    }
    if (input.memberships) {
      await transaction.membership.deleteMany({ where: { userId: previous.id } })
    }
    const user = await transaction.user.update({
      where: { id: previous.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.active !== undefined && { active: input.active }),
        ...(input.memberships && {
          memberships: { create: input.memberships.map(({ shopId, role }) => ({ shopId, role })) },
        }),
      },
      include: membershipsInclude,
    })
    await writeAudit(request, {
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: user.id,
      metadata: { changedName: input.name !== undefined, changedActive: input.active !== undefined, changedMemberships: input.memberships !== undefined },
    }, transaction)
    return user
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  response.json({ user: userDto(updated) })
})

export default router