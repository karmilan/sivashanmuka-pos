import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectDirectory = resolve(serverDirectory, '..')
dotenv.config({ path: resolve(serverDirectory, '.env') })

function refuse(reason) {
  console.error(`Refusing database command: ${reason}`)
  process.exit(1)
}

if (process.env.NODE_ENV !== 'development') {
  refuse('NODE_ENV must be development.')
}

const targetBranch = process.env.NEON_TARGET_BRANCH?.trim()
if (!targetBranch || targetBranch.toLowerCase() === 'production') {
  refuse('Set NEON_TARGET_BRANCH to the verified non-production development branch name.')
}

let neonConfig
try {
  neonConfig = JSON.parse(readFileSync(resolve(projectDirectory, '.neon'), 'utf8'))
} catch {
  refuse('A valid local .neon link selecting the development branch is required.')
}

if (neonConfig.branch !== targetBranch) {
  refuse('The local .neon link must select the same development branch as NEON_TARGET_BRANCH.')
}

function connectionUrl(name) {
  const value = process.env[name]
  if (!value) refuse(`${name} is required.`)

  let url
  try {
    url = new URL(value)
  } catch {
    refuse(`${name} must be a valid Neon PostgreSQL URL.`)
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    refuse(`${name} must use PostgreSQL.`)
  }
  if (url.searchParams.get('sslmode') !== 'require') {
    refuse(`${name} must require SSL with sslmode=require.`)
  }
  return url
}

const pooledUrl = connectionUrl('DATABASE_URL')
const directUrl = connectionUrl('DIRECT_DATABASE_URL')

if (!pooledUrl.hostname.includes('-pooler')) {
  refuse('DATABASE_URL must use the Neon pooled endpoint.')
}
if (directUrl.hostname.includes('-pooler')) {
  refuse('DIRECT_DATABASE_URL must use the Neon direct endpoint.')
}
if (pooledUrl.hostname.replace(/-pooler(?=\.)/, '') !== directUrl.hostname) {
  refuse('The pooled and direct URLs must identify the same Neon endpoint.')
}
if (pooledUrl.username !== directUrl.username || pooledUrl.pathname !== directUrl.pathname) {
  refuse('The pooled and direct URLs must identify the same database role and database.')
}

console.log('Development Neon target acknowledged; pooled/direct endpoint configuration is consistent.')
