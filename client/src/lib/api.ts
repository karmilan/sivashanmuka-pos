import type { ApiErrorDto, SessionDto } from '../../../shared/api'

const apiBase = `${(import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
let csrfToken = ''

export class ApiClientError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch(`${apiBase}/auth/csrf`, { credentials: 'include' })
  if (!response.ok) throw new ApiClientError('Could not establish a secure session.', response.status, 'CSRF_SETUP_FAILED')
  const result = await response.json() as { csrfToken: string }
  csrfToken = result.csrfToken
  return csrfToken
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('X-CSRF-Token', await getCsrfToken())
  const response = await fetch(`${apiBase}${path}`, { ...options, method, headers, credentials: 'include' })
  if (response.status === 204) {
    if (path === '/auth/logout') csrfToken = ''
    return undefined as T
  }
  const payload = await response.json() as ApiErrorDto & Partial<{ csrfToken: string }>
  if (!response.ok) {
    throw new ApiClientError(payload.error?.message ?? 'Request failed.', response.status, payload.error?.code ?? 'REQUEST_FAILED')
  }
  if (payload.csrfToken) csrfToken = payload.csrfToken
  return payload as T
}

export async function getSession(): Promise<SessionDto | null> {
  try {
    return await apiRequest<SessionDto>('/auth/session')
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) return null
    throw error
  }
}