import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: error.issues.map(({ path, code, message }) => ({ path, code, message })),
      },
      requestId: String(request.id),
    })
    return
  }

  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.parse.failed') {
    response.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
      requestId: String(request.id),
    })
    return
  }
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    response.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' },
      requestId: String(request.id),
    })
    return
  }

  const status = error instanceof ApiError ? error.status : 500
  const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR'
  const message = error instanceof ApiError ? error.message : 'An unexpected error occurred.'
  if (status === 500) request.log.error({ err: error }, 'Unhandled request error')
  response.status(status).json({ error: { code, message }, requestId: String(request.id) })
}