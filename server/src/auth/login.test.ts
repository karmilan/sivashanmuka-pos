import assert from 'node:assert/strict'
import { Role } from '@prisma/client'
import type { Server } from 'node:http'
import { test } from 'node:test'

process.env.NODE_ENV = 'test'
process.env.PORT = '4000'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test?schema=public'
process.env.SESSION_SECRET = 'test-session-secret-at-least-thirty-two-characters'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.TRUST_PROXY = 'false'

const { createApp } = await import('../app.js')
const { createAuthRouter } = await import('../routes/auth.js')

async function startServer(authRouter: ReturnType<typeof createAuthRouter>): Promise<{ server: Server; baseUrl: string }> {
  const server = createApp(authRouter).listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port.')
  return { server, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

async function getCsrf(baseUrl: string): Promise<{ csrfToken: string; cookie: string }> {
  const response = await fetch(`${baseUrl}/api/v1/auth/csrf`)
  assert.equal(response.status, 200)
  const { csrfToken } = await response.json() as { csrfToken: string }
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0]
  assert.ok(cookie)
  return { csrfToken, cookie }
}

function loginUser(passwordHash: string) {
  const now = new Date()
  return {
    id: 'owner-1',
    email: 'owner@example.test',
    name: 'Owner',
    passwordHash,
    active: true,
    createdAt: now,
    updatedAt: now,
    memberships: [{
      userId: 'owner-1',
      shopId: 'shop-1',
      role: Role.OWNER,
      createdAt: now,
      shop: {
        id: 'shop-1',
        code: 'MAIN',
        name: 'Main shop',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    }],
  }
}

test('successful login writes exactly one safe LOGIN audit event', async () => {
  const password = 'correct-password-value'
  const passwordHash = 'stored-password-hash'
  const sessionSecret = process.env.SESSION_SECRET
  assert.ok(sessionSecret)
  const auditEvents: Array<{ action: string; entity: string; entityId?: string }> = []
  const authRouter = createAuthRouter({
    findUser: async () => loginUser(passwordHash),
    comparePassword: async (candidate, hash) => candidate === password && hash === passwordHash,
    writeAudit: async (_request, data) => { auditEvents.push(data) },
  })
  const started = await startServer(authRouter)

  try {
    const { csrfToken, cookie } = await getCsrf(started.baseUrl)
    const response = await fetch(`${started.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        Cookie: cookie,
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'owner@example.test', password }),
    })
    assert.equal(response.status, 200)
    assert.deepEqual(auditEvents, [{ action: 'LOGIN', entity: 'User', entityId: 'owner-1' }])

    const body = await response.text()
    assert.equal(body.includes(password), false)
    assert.equal(body.includes(passwordHash), false)
    assert.equal(body.includes(sessionSecret), false)
    const serializedAudit = JSON.stringify(auditEvents)
    assert.equal(serializedAudit.includes(password), false)
    assert.equal(serializedAudit.includes(passwordHash), false)
    assert.equal(serializedAudit.includes(sessionSecret), false)
  } finally {
    await stopServer(started.server)
  }
})

test('failed login writes no successful LOGIN audit event', async () => {
  const sessionSecret = process.env.SESSION_SECRET
  assert.ok(sessionSecret)
  const auditEvents: Array<{ action: string }> = []
  const authRouter = createAuthRouter({
    findUser: async () => loginUser('stored-password-hash'),
    comparePassword: async () => false,
    writeAudit: async (_request, data) => { auditEvents.push(data) },
  })
  const started = await startServer(authRouter)

  try {
    const { csrfToken, cookie } = await getCsrf(started.baseUrl)
    const response = await fetch(`${started.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        Cookie: cookie,
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'owner@example.test', password: 'incorrect-password' }),
    })
    assert.equal(response.status, 401)
    assert.deepEqual(auditEvents, [])
    const body = await response.text()
    assert.equal(body.includes('incorrect-password'), false)
    assert.equal(body.includes(sessionSecret), false)
  } finally {
    await stopServer(started.server)
  }
})
