import { describe, expect, test } from 'bun:test'
import { AccessError } from '../../src/lib/auth/access-error'
import { getAuthenticatedUploadMetadata } from '../../src/features/uploads/upload-auth'

describe('upload authentication metadata', () => {
  test('rejects an auth result without a user id', async () => {
    await expect(
      getAuthenticatedUploadMetadata(async () => null)
    ).rejects.toBeInstanceOf(AccessError)
  })

  test('rejects a blank provider subject', async () => {
    await expect(
      getAuthenticatedUploadMetadata(async () => ({ subject: '   ' }))
    ).rejects.toBeInstanceOf(AccessError)
  })

  test('returns only the immutable provider subject', async () => {
    await expect(
      getAuthenticatedUploadMetadata(async () => ({ subject: 'user-a' }))
    ).resolves.toEqual({ userId: 'user-a' })
  })
})
