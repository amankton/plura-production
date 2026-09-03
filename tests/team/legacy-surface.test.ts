import { describe, expect, test } from 'bun:test'

const sourceGlob = new Bun.Glob('src/**/*.{ts,tsx}')

const readSource = async () => {
  const files: { path: string; text: string }[] = []
  for await (const path of sourceGlob.scan({ cwd: process.cwd() })) {
    files.push({ path, text: await Bun.file(path).text() })
  }
  return files
}

describe('B3 legacy authority surface', () => {
  test('removes generic user and permission exports from the broad action module', async () => {
    const queries = await Bun.file('src/lib/queries.ts').text()
    for (const name of [
      'changeUserPermissions',
      'createTeamUser',
      'deleteUser',
      'getUser',
      'getUserPermissions',
      'initUser',
      'sendInvitation',
      'updateUser',
      'verifyAndAcceptInvitation',
    ]) {
      expect(queries).not.toMatch(
        new RegExp(`export\\s+const\\s+${name}\\b`)
      )
    }
  })

  test('contains no provider-role authorization reads or email-selected agency owner connection', async () => {
    const files = await readSource()
    const combined = files.map((file) => file.text).join('\n')
    expect(combined).not.toContain('privateMetadata.role')
    expect(combined).not.toContain('connect: { email: agency.companyEmail }')
    expect(combined).not.toMatch(
      /publicMetadata\s*:\s*\{[^}]*\brole\b[^}]*\}/
    )
    expect(combined).not.toMatch(/updateUserMetadata\s*\(/)
  })

  test('keeps database and provider adapters out of client modules', async () => {
    const files = await readSource()
    const clientModules = files.filter((file) =>
      file.text.trimStart().startsWith("'use client'")
    )
    for (const file of clientModules) {
      expect(file.text).not.toContain('server-team-service')
      expect(file.text).not.toContain('server-account-service')
      expect(file.text).not.toMatch(/from ['"]@\/lib\/db['"]/)
    }
  })
})
