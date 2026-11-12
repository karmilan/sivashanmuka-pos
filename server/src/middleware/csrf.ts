import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { RequestHandler } from 'express'
import { env } from '../config/env.js'
import { ApiError } from '../lib/errors.js'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

export const enforceOriginAndCsrf: RequestHandler = (request, _response, next) => {
  if (safeMethods.has(request.method)) return next()
  if (request.get('origin') !== env.CLIENT_ORIGIN) {
    return next(new ApiError(403, 'ORIGIN_FORBIDDEN', 'Request origin is not allowed.'))
  }

  const expected = request.session.csrfToken
  const provided = request.get('x-csrf-token')
  if (!expected || !provided) {
    return next(new ApiError(403, 'CSRF_INVALID', 'A valid CSRF token is required.'))
  }
  const expectedBytes = Buffer.from(expected)
  const providedBytes = Buffer.from(provided)
  if (expectedBytes.length !== providedBytes.length || !timingSafeEqual(expectedBytes, providedBytes)) {
    return next(new ApiError(403, 'CSRF_INVALID', 'A valid CSRF token is required.'))
  }
  return next()
}

export function rotateCsrfToken(request: Parameters<RequestHandler>[0]): string {
  const token = randomBytes(32).toString('base64url')
  request.session.csrfToken = token
  return token
}