import { env } from './config/env.js'
import { createApp } from './app.js'
import { prisma } from './lib/prisma.js'

const app = createApp()
const server = app.listen(env.PORT, () => {
  console.info(`API listening on port ${env.PORT}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(async () => {
      await prisma.$disconnect()
      process.exit(0)
    })
  })
}