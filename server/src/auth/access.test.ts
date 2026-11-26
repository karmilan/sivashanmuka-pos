import assert from 'node:assert/strict'
import test from 'node:test'
import type { NextFunction, Request, Response } from 'express'
import { Role } from '@prisma/client'
import { hasRole, membershipForShop } from './access.js'
import { ApiError } from '../lib/errors.js'
import { requireCatalogueMembership, requireOwner } from '../middleware/authorization.js'

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

test('owner authorization permits owners and rejects non-owners', () => {
  function invoke(role: Role) {
    let nextError: unknown
    let continued = false
    const request = {
      auth: { userId: 'user-1', memberships: [{ shopId: 'shop-a', role }] },
    } as unknown as Request
    const next = ((error?: Error) => {
      if (error) nextError = error
      else continued = true
    }) as NextFunction

    requireOwner(request, {} as Response, next)
    return { continued, nextError }
  }

  assert.deepEqual(invoke(Role.OWNER), { continued: true, nextError: undefined })
  const nonOwner = invoke(Role.MANAGER)
  assert.equal(nonOwner.continued, false)
  assert.ok(nonOwner.nextError instanceof ApiError)
  assert.equal((nonOwner.nextError as ApiError).status, 403)
  assert.equal((nonOwner.nextError as ApiError).code, 'FORBIDDEN')
})

test('category mutation authorization rejects manager and cashier memberships', () => {
  for (const role of [Role.MANAGER, Role.CASHIER]) {
    let nextError: unknown
    let continued = false
    const request = {
      auth: { userId: 'user-1', memberships: [{ shopId: 'shop-a', role }] },
    } as unknown as Request
    const next = ((error?: Error) => {
      if (error) nextError = error
      else continued = true
    }) as NextFunction

    requireOwner(request, {} as Response, next)

    assert.equal(continued, false)
    assert.ok(nextError instanceof ApiError)
    assert.equal((nextError as ApiError).status, 403)
    assert.equal((nextError as ApiError).code, 'FORBIDDEN')
  }
})

test('catalogue reads allow every staff role with a server-loaded active shop membership', () => {
  for (const role of [Role.OWNER, Role.MANAGER, Role.CASHIER]) {
    let nextError: unknown
    let continued = false
    const request = {
      auth: { userId: 'user-1', memberships: [{ shopId: 'assigned-shop', role }] },
      get: () => 'unassigned-shop',
    } as unknown as Request
    const next = ((error?: Error) => {
      if (error) nextError = error
      else continued = true
    }) as NextFunction

    requireCatalogueMembership(request, {} as Response, next)
    assert.deepEqual({ continued, nextError }, { continued: true, nextError: undefined })
  }
})

test('catalogue reads reject an authenticated user without an active shop membership', () => {
  let nextError: unknown
  let continued = false
  const request = {
    auth: { userId: 'user-1', memberships: [] },
    get: () => 'client-supplied-shop',
  } as unknown as Request
  const next = ((error?: Error) => {
    if (error) nextError = error
    else continued = true
  }) as NextFunction

  requireCatalogueMembership(request, {} as Response, next)

  assert.equal(continued, false)
  assert.ok(nextError instanceof ApiError)
  assert.equal((nextError as ApiError).status, 403)
  assert.equal((nextError as ApiError).code, 'SHOP_FORBIDDEN')
})