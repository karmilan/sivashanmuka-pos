import bcrypt from 'bcryptjs'
import { Router } from 'express'
import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import rateLimit from 'express-rate-limit'
import type { LoginResponseDto, SessionDto, UserDto } from '../../../shared/api.js'
import { changePasswordSchema, loginSchema } from '../auth/schemas.js'
import { env } from '../config/env.js'
import { requireAuth } from '../middleware/authorization.js'
import { rotateCsrfToken } from '../middleware/csrf.js'
import { writeAudit } from '../lib/audit.js'
import { ApiError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'LOGIN_RATE_LIMITED', message: 'Too many sign-in attempts. Try again later.' } },
})
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'PASSWORD_RATE_LIMITED', message: 'Too many password changes. Try again later.' } },
})

const loginUserInclude = {
  memberships: { where: { shop: { active: true } }, include: { shop: true } },
} satisfies Prisma.UserInclude
type LoginUser = Prisma.UserGetPayload<{ include: typeof loginUserInclude }>
type LoginDependencies = {
  findUser(email: string): Promise<LoginUser | null>
  comparePassword(password: string, passwordHash: string): Promise<boolean>
  writeAudit(request: Request, data: Parameters<typeof writeAudit>[1]): Promise<void>
}

const defaultLoginDependencies: LoginDependencies = {
  findUser: (email) => prisma.user.findUnique({ where: { email }, include: loginUserInclude }),
  comparePassword: (password, passwordHash) => bcrypt.compare(password, passwordHash),
  writeAudit: (request, data) => writeAudit(request, data),
}

export function createAuthRouter(loginDependencies: LoginDependencies = defaultLoginDependencies) {
  const router = Router()

  router.get('/csrf', (request, response, next) => {
    const token = request.session.csrfToken ?? rotateCsrfToken(request)
    request.session.save((error) => {
      if (error) return next(error)
      response.json({ csrfToken: token })
    })
  })

  router.post('/login', loginLimiter, async (request, response) => {
    const { email, password } = loginSchema.parse(request.body)
    const user = await loginDependencies.findUser(email)
    const validPassword = user ? await loginDependencies.comparePassword(password, user.passwordHash) : false
    if (!user || !user.active || !validPassword || user.memberships.length === 0) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
    }

    await new Promise<void>((resolve, reject) => {
      request.session.regenerate((error) => (error ? reject(error) : resolve()))
    })
    request.session.userId = user.id
    const csrfToken = rotateCsrfToken(request)
    await new Promise<void>((resolve, reject) => {
      request.session.save((error) => (error ? reject(error) : resolve()))
    })
    request.auth = {
      userId: user.id,
      memberships: user.memberships.map(({ shopId, role }) => ({ shopId, role })),
    }
    const userDto: UserDto = {
      id: user.id,
      email: user.email,
      name: user.name,
      active: user.active,
      memberships: user.memberships.map(({ shopId, role, shop }) => ({ shopId, shopName: shop.name, role })),
    }
    const result: LoginResponseDto = {
      user: userDto,
      csrfToken,
    }
    await loginDependencies.writeAudit(request, { action: 'LOGIN', entity: 'User', entityId: user.id })
    response.json(result)
  })

  router.get('/session', requireAuth, async (request, response) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.auth!.userId },
      include: { memberships: { where: { shop: { active: true } }, include: { shop: true } } },
    })
    const result: SessionDto = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        active: user.active,
        memberships: user.memberships.map(({ shopId, role, shop }) => ({ shopId, shopName: shop.name, role })),
      },
    }
    response.json(result)
  })

  router.post('/password', passwordChangeLimiter, requireAuth, async (request, response) => {
    const input = changePasswordSchema.parse(request.body)
    const user = await prisma.user.findUnique({
      where: { id: request.auth!.userId },
      select: { id: true, passwordHash: true },
    })
    if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw new ApiError(403, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.')
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12)
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({ where: { id: user.id }, data: { passwordHash } })
      await transaction.$executeRaw`DELETE FROM "user_sessions" WHERE "sess"->>'userId' = ${user.id}`
      await writeAudit(request, { action: 'PASSWORD_CHANGED', entity: 'User', entityId: user.id }, transaction)
    })

    await new Promise<void>((resolve, reject) => {
      request.session.regenerate((error) => (error ? reject(error) : resolve()))
    })
    request.session.userId = user.id
    const csrfToken = rotateCsrfToken(request)
    await new Promise<void>((resolve, reject) => {
      request.session.save((error) => (error ? reject(error) : resolve()))
    })
    response.json({ csrfToken })
  })

  router.post('/logout', requireAuth, async (request, response, next) => {
    await writeAudit(request, { action: 'LOGOUT', entity: 'User', entityId: request.auth!.userId })
    request.session.destroy((error) => {
      if (error) return next(error)
      response.clearCookie('yuva.sid', {
        httpOnly: true,
        sameSite: 'strict',
        secure: env.NODE_ENV === 'production' || env.NODE_ENV === 'staging',
        path: '/',
      })
      response.status(204).end()
    })
  })

  return router
}

export default createAuthRouter()