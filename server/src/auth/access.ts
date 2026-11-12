import { Role } from '@prisma/client'

export interface AccessMembership {
  shopId: string
  role: Role
}

export function membershipForShop(
  memberships: readonly AccessMembership[],
  shopId: string,
): AccessMembership | undefined {
  return memberships.find((membership) => membership.shopId === shopId)
}

export function hasRole(memberships: readonly AccessMembership[], roles: readonly Role[]): boolean {
  return memberships.some((membership) => roles.includes(membership.role))
}