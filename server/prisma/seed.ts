import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, Role } from '@prisma/client'

const prisma = new PrismaClient()

async function seed(): Promise<void> {
  const shops = [
    { code: 'MULTY-STORE', name: 'SIVASHANMUKA MULTY STORE' },
    { code: 'SMART-SHOP', name: 'SIVASHANMUKA SMART SHOP' },
  ]

  for (const shop of shops) {
    await prisma.shop.upsert({
      where: { code: shop.code },
      update: {},
      create: shop,
    })
  }

  const email = process.env.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase()
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD
  if (!email && !password) return
  if (!email || !password || password.length < 12) {
    throw new Error('Set both bootstrap owner values; the password must be at least 12 characters.')
  }

  const existingOwner = await prisma.membership.findFirst({ where: { role: Role.OWNER } })
  if (existingOwner) throw new Error('An owner already exists; bootstrap creation is one-time only.')

  const shopRecords = await prisma.shop.findMany({ where: { code: { in: shops.map(({ code }) => code) } } })
  await prisma.user.create({
    data: {
      email,
      name: process.env.BOOTSTRAP_OWNER_NAME?.trim() || 'Owner',
      passwordHash: await bcrypt.hash(password, 12),
      memberships: { create: shopRecords.map((shop) => ({ shopId: shop.id, role: Role.OWNER })) },
    },
  })
}

seed()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())