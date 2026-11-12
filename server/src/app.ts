import { randomUUID } from 'node:crypto'
import cors from 'cors'
import express from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { env } from './config/env.js'
import { enforceOriginAndCsrf } from './middleware/csrf.js'
import authRouter from './routes/auth.js'
import shopsRouter from './routes/shops.js'
import usersRouter from './routes/users.js'
import { prisma } from './lib/prisma.js'
import { ApiError, errorHandler } from './lib/errors.js'

const PgSessionStore = connectPgSimple(session)

export function createApp(auth = authRouter) {
  const app = express()
  const secureTransport = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging'
  if (env.TRUST_PROXY) app.set('trust proxy', 1)

  app.use(helmet(secureTransport ? {} : {
    strictTransportSecurity: false,
    contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
  }))
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Shop-Id'] }))
  app.use(express.json({ limit: '32kb' }))
  app.use(pinoHttp({
    genReqId: () => randomUUID(),
    redact: ['req.headers.cookie', 'req.headers.authorization'],
    serializers: {
      req: (request) => ({ id: String(request.id), method: request.method, url: request.url }),
      res: (response) => ({ statusCode: response.statusCode }),
    },
  }))
  const sessionStore = env.NODE_ENV === 'test' ? undefined : new PgSessionStore({
    conString: env.DATABASE_URL,
    tableName: 'user_sessions',
    createTableIfMissing: false,
    ttl: 8 * 60 * 60,
  })
  app.use(session({
    name: 'yuva.sid',
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    ...(sessionStore && { store: sessionStore }),
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.NODE_ENV === 'production' || env.NODE_ENV === 'staging',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    },
  }))
  app.use(enforceOriginAndCsrf)

  app.get('/health/live', (_request, response) => response.json({ status: 'ok' }))
  app.get('/health/ready', async (_request, response) => {
    await prisma.$queryRaw`SELECT 1`
    response.json({ status: 'ready' })
  })

  const api = express.Router()
  api.use('/auth', auth)
  api.use('/shops', shopsRouter)
  api.use('/users', usersRouter)
  app.use('/api/v1', api)
  app.use((_request, _response, next) => next(new ApiError(404, 'NOT_FOUND', 'The requested resource was not found.')))
  app.use(errorHandler)
  return app
}