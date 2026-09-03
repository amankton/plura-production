import { describe, expect, test } from 'bun:test'

const sourceGlob = new Bun.Glob('src/**/*.{ts,tsx}')

const readSource = async () => {
  const files: string[] = []
  for await (const path of sourceGlob.scan({ cwd: process.cwd() })) {
    files.push(await Bun.file(path).text())
  }
  return files.join('\n')
}

describe('Clerk v6 upgrade surface', () => {
  test('changes only the intended identity dependency family', async () => {
    const manifest = await Bun.file('package.json').json()
    expect(manifest.dependencies['@clerk/nextjs']).toBe('6.39.6')
    expect(manifest.dependencies['@clerk/themes']).toBe('2.4.63')
    expect(manifest.dependencies.next).toBe('14.2.35')
    expect(manifest.dependencies.react).toBe('^18.3.1')
    expect(manifest.dependencies['react-dom']).toBe('^18.3.1')
    expect(manifest.dependencies['@prisma/client']).toBe('5.22.0')
    expect(manifest.dependencies.uploadthing).toBe('6.13.3')
    expect(manifest.dependencies.stripe).toBe('22.6.1')
  })

  test('keeps all server auth helpers on the server-only Clerk entry point', async () => {
    const source = await readSource()
    expect(source).not.toContain('authMiddleware')
    expect(source).not.toMatch(
      /import\s*\{[^}]*(?:auth|clerkClient|currentUser)[^}]*\}\s*from\s*['"]@clerk\/nextjs['"]/
    )
    expect(source).not.toContain('privateMetadata.role')
    expect(source).not.toMatch(/updateUserMetadata\s*\(/)
  })
})
