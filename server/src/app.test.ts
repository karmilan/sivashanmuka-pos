import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { Server } from 'node:http'

process.env.NODE_ENV = 'test'
process.env.PORT = '4000'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test?schema=public'
process.env.SESSION_SECRET = 'test-session-secret-at-least-thirty-two-characters'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.TRUST_PROXY = 'false'

const { createApp } = await import('./app.js')
let server: Server
let baseUrl: string

before(async () => {
  server = createApp().listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port.')
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('liveness endpoint works without a database connection', async () => {
  const response = await fetch(`${baseUrl}/health/live`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('protected session endpoint rejects anonymous requests', async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/session`)
  assert.equal(response.status, 401)
  const result = await response.json() as { error: { code: string } }
  assert.equal(result.error.code, 'UNAUTHENTICATED')
})

test('state-changing requests reject untrusted origins', async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.test', password: 'not-a-real-password' }),
  })
  assert.equal(response.status, 403)
  const result = await response.json() as { error: { code: string } }
  assert.equal(result.error.code, 'ORIGIN_FORBIDDEN')
})

test('same-origin state changes still require a session CSRF token', async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.test', password: 'not-a-real-password' }),
  })
  assert.equal(response.status, 403)
  const result = await response.json() as { error: { code: string } }
  assert.equal(result.error.code, 'CSRF_INVALID')
})

test('malformed JSON uses the standard client error response', async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    body: '{"email":',
  })
  assert.equal(response.status, 400)
  const result = await response.json() as { error: { code: string } }
  assert.equal(result.error.code, 'INVALID_JSON')
})

test('validation errors never echo submitted passwords', async () => {
  const password = 'example-password-that-must-not-be-echoed'
  const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`)
  const { csrfToken } = await csrfResponse.json() as { csrfToken: string }
  const cookie = csrfResponse.headers.get('set-cookie')?.split(';', 1)[0]
  assert.ok(cookie)
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173',
      Cookie: cookie,
      'X-CSRF-Token': csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: 'invalid-email', password }),
  })
  assert.equal(response.status, 400)
  const body = await response.text()
  assert.equal(body.includes(password), false)
  assert.match(body, /VALIDATION_ERROR/)
})