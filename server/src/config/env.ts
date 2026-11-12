import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  CLIENT_ORIGIN: z.string().url().refine((value) => new URL(value).origin === value, {
    message: 'CLIENT_ORIGIN must be an origin without a path or trailing slash.',
  }),
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
})

const result = envSchema.safeParse(process.env)
if (!result.success) {
  throw new Error(`Invalid server environment: ${z.prettifyError(result.error)}`)
}

export const env = result.data