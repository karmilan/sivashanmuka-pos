import { z } from 'zod'
import { Role } from '@prisma/client'

const passwordSchema = z.string().min(12).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
  message: 'Password must be no more than 72 bytes.',
})

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
  password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
  newPassword: passwordSchema,
}).refine((value) => value.currentPassword !== value.newPassword, {
  message: 'New password must differ from the current password.',
  path: ['newPassword'],
})

const membershipSchema = z.object({ shopId: z.uuid(), role: z.enum(Role) })

export const createUserSchema = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
  name: z.string().trim().min(1).max(120),
  password: passwordSchema,
  memberships: z.array(membershipSchema).min(1).refine(
    (memberships) => new Set(memberships.map(({ shopId }) => shopId)).size === memberships.length,
    'A user can have only one role per shop.',
  ),
})

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  active: z.boolean().optional(),
  memberships: z.array(membershipSchema).min(1).refine(
    (memberships) => new Set(memberships.map(({ shopId }) => shopId)).size === memberships.length,
    'A user can have only one role per shop.',
  ).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required.')