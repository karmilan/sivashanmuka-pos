import assert from 'node:assert/strict'
import test from 'node:test'
import { Role } from '@prisma/client'
import { hasRole, membershipForShop } from './access.js'

const memberships = [
  { shopId: 'shop-a', role: Role.MANAGER },
  { shopId: 'shop-b', role: Role.CASHIER },
]

test('only resolves a shop explicitly assigned to the user', () => {
  assert.equal(membershipForShop(memberships, 'shop-a')?.role, Role.MANAGER)
  assert.equal(membershipForShop(memberships, 'shop-c'), undefined)
})

test('checks roles from server-loaded memberships', () => {
  assert.equal(hasRole(memberships, [Role.MANAGER]), true)
  assert.equal(hasRole(memberships, [Role.OWNER]), false)
})