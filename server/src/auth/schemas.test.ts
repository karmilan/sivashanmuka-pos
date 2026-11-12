import assert from 'node:assert/strict'
import test from 'node:test'
import { changePasswordSchema, loginSchema } from './schemas.js'

test('login normalizes email addresses', () => {
  const result = loginSchema.parse({ email: '  Staff@Example.test ', password: 'valid-password' })
  assert.equal(result.email, 'staff@example.test')
})

test('password changes require a sufficiently long password', () => {
  assert.equal(changePasswordSchema.safeParse({ currentPassword: 'old-password', newPassword: 'short' }).success, false)
  assert.equal(changePasswordSchema.safeParse({ currentPassword: 'same-password', newPassword: 'same-password' }).success, false)
  assert.equal(changePasswordSchema.safeParse({ currentPassword: 'old-password', newPassword: 'a-valid-new-password' }).success, true)
})

test('password changes reject values that exceed bcrypt byte limits', () => {
  const overLimit = '界'.repeat(25)
  assert.equal(changePasswordSchema.safeParse({ currentPassword: 'old-password', newPassword: overLimit }).success, false)
})