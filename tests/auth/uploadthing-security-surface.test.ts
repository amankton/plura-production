import { describe, expect, test } from 'bun:test'

const uploadRouterPath = 'src/app/api/uploadthing/core.ts'

describe('UploadThing security hotfix surface', () => {
  test('pins patched Effect while freezing the UploadThing API leaf', async () => {
    const manifest = await Bun.file('package.json').json()

    expect(manifest.overrides.effect).toBe('3.22.1')
    expect(manifest.dependencies.uploadthing).toBe('6.13.3')
    expect(manifest.dependencies['@uploadthing/react']).toBe('6.8.0')
    expect(manifest.dependencies.next).toBe('14.2.35')
    expect(manifest.dependencies.react).toBe('^18.3.1')
    expect(manifest.dependencies['@clerk/nextjs']).toBe('6.39.6')
    expect(manifest.dependencies['@prisma/client']).toBe('5.22.0')
    expect(manifest.dependencies.stripe).toBe('14.25.0')
  })

  test('keeps every file route behind server-derived authentication', async () => {
    const source = await Bun.file(uploadRouterPath).text()

    for (const route of ['subaccountLogo', 'avatar', 'agencyLogo', 'media']) {
      expect(source).toMatch(
        new RegExp(`${route}:[\\s\\S]*?\\.middleware\\(authenticateUser\\)`)
      )
    }
    expect(source).toContain(
      'getAuthenticatedUploadMetadata(clerkIdentityProvider)'
    )
    expect(source).not.toMatch(/input\([^)]*userId/)
    expect(source).not.toMatch(/headers?\([^)]*userId/)
  })
})
