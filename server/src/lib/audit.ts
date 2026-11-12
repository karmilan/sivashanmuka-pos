import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'

export async function writeAudit(
  request: Request,
  data: {
    action: string
    entity: string
    entityId?: string
    shopId?: string
    metadata?: Prisma.InputJsonValue
  },
  client: Pick<Prisma.TransactionClient, 'auditLog'> = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      action: data.action,
      entity: data.entity,
      requestId: String(request.id),
      ...(request.auth && { actorId: request.auth.userId }),
      ...(data.shopId && { shopId: data.shopId }),
      ...(data.entityId && { entityId: data.entityId }),
      ...(request.ip && { ipAddress: request.ip }),
      ...(data.metadata !== undefined && { metadata: data.metadata }),
    },
  })
}