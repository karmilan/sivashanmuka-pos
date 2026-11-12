import type { Role } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string
        memberships: Array<{ shopId: string; role: Role }>
      }
      shopMembership?: { shopId: string; role: Role }
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string
    csrfToken?: string
  }
}

export {}