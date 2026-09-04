import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const normalizedHash = (text: string) =>
  createHash('sha256')
    .update(text.replaceAll('\r\n', '\n'))
    .digest('hex')

const productionPaths = [
  'src/features/agency-projections/projection-service.ts',
  'src/features/agency-projections/server-projection-service.ts',
  'src/features/agency-projections/actions.ts',
]

describe('B5A2A closed projection surface', () => {
  test('passes the fixed-input verifier and rejects caller-controlled arguments', () => {
    const pass = Bun.spawnSync([
      process.execPath,
      'scripts/verify-b5a2a-projections.ts',
    ])
    expect(pass.exitCode).toBe(0)
    expect(pass.stderr.toString()).toBe('')
    expect(pass.stdout.toString()).toBe(
      'B5A2A_PASS records=14 projections=7 client_actions=1 consumers=3 compatibility_sinks=2 entry_calls=4\n'
    )

    const denied = Bun.spawnSync([
      process.execPath,
      'scripts/verify-b5a2a-projections.ts',
      'unexpected',
    ])
    expect(denied.exitCode).toBe(1)
    expect(denied.stdout.toString()).toBe('')
    expect(denied.stderr.toString()).toBe('B5A2A_FAIL argument-count\n')
  })

  test('exposes one client action and keeps Prisma and identity in the server adapter', () => {
    const action = read('src/features/agency-projections/actions.ts')
    const pure = read('src/features/agency-projections/projection-service.ts')
    const server = read(
      'src/features/agency-projections/server-projection-service.ts'
    )
    expect(action.match(/^export const /gm)).toHaveLength(1)
    expect(action).toContain('listTicketAssigneeOptions')
    expect(action).not.toMatch(/\b(db|currentUser|auth|clerkClient)\b/)
    expect(pure).not.toMatch(/from ['"]@\/lib\/db['"]|server-only/)
    expect(server).toContain("import 'server-only'")
    expect(server).toContain('clerkIdentityProvider')
    expect(server).not.toMatch(/\binclude\s*:/)
    expect(server).not.toMatch(/select\s*:\s*true\s*[,}]/)
  })

  test('binds persistence reads to operation-specific actor and tenant predicates', () => {
    const server = read(
      'src/features/agency-projections/server-projection-service.ts'
    )
    expect(server).toContain(
      'where: { agencyId: values.agencyId, id: values.actorId }'
    )
    expect(server).toContain(
      'where: { agencyId: values.agencyId, id: values.subaccountId }'
    )
    expect(server).toContain('User: { agencyId: values.agencyId, id: values.actorId }')
    expect(server).toContain('SubAccount: { agencyId: values.agencyId }')
    expect(server).toContain('role: Role.SUBACCOUNT_USER')
    expect(server).toContain('access: true')
    expect(server.match(/take: 2/g)?.length).toBeGreaterThanOrEqual(7)
  })

  test('defines exact DTO field sets without Prisma model aliases or broad results', () => {
    const pure = read('src/features/agency-projections/projection-service.ts')
    const menu = read('src/components/sidebar/menu-options.tsx')
    const agencyForm = read('src/components/forms/agency-details.tsx')
    const subaccountForm = read('src/components/forms/subaccount-details.tsx')
    const ticketForm = read('src/components/forms/ticket-form.tsx')

    expect(pure).not.toMatch(/\bany\b|Prisma\.|JSON\.parse|JSON\.stringify/)
    expect(menu).not.toMatch(/\bany\b|\bas\s+(Agency|SubAccount|string)\b/)
    expect(agencyForm).not.toContain("from '@prisma/client'")
    expect(subaccountForm).not.toContain("from '@prisma/client'")
    expect(ticketForm).toContain('readonly TicketAssigneeOption[]')
    expect(ticketForm).not.toMatch(/useState<User\[\]>/)
  })

  test('removes broad legacy reads and keeps exactly three narrowed form consumers', () => {
    const sourceFiles = Bun.spawnSync(['git', 'ls-files', 'src']).stdout
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
    const source = sourceFiles.map(read).join('\n')
    expect(source).not.toMatch(/\bgetAuthUserDetails\b/)
    expect(source).not.toMatch(/\bgetSubAccountTeamMembers\b/)
    expect(read('src/lib/types.ts')).not.toContain("from './db'")

    const consumers = sourceFiles.filter((path) =>
      /<SubAccountDetails\b/.test(read(path))
    )
    expect(consumers.sort()).toEqual([
      'src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx',
      'src/app/(main)/subaccount/[subaccountId]/settings/page.tsx',
      'src/components/sidebar/menu-options.tsx',
    ])
    expect(consumers.map(read).join('\n')).not.toMatch(/\buserId\s*=/)
  })

  test('keeps frozen account entry and layout sources exact', () => {
    expect(normalizedHash(read('src/features/accounts/actions.ts'))).toBe(
      'e3804c4486b39ae11af2416e3bf7c125d5ad1e702fbd6715b16084ecadda598d'
    )
    expect(
      normalizedHash(read('src/app/(main)/agency/[agencyId]/layout.tsx'))
    ).toBe('60e507efcdb0ffc6df440afdd31d81ab48aaea15a36ece960ca5100525d63525')
    expect(
      normalizedHash(read('src/app/(main)/subaccount/[subaccountId]/layout.tsx'))
    ).toBe('d12f84b0abbee14d4fd62013cc765941381287b810b7e2c5e8974b9cdd8db08d')
  })

  test('keeps the verifier offline and fixed to its reviewed paths and hashes', () => {
    const verifier = read('scripts/verify-b5a2a-projections.ts')
    expect(verifier).not.toMatch(/process\.env|\bfetch\s*\(|https?:\/\//)
    expect(verifier).toContain(
      "const IMPLEMENTATION_PARENT = 'bbe5ec82a8184c21fc0d09f767891c5dc7f08534'"
    )
    expect(verifier).toContain('remainder:queries')
    expect(verifier).toContain('remainder:types')
    expect(verifier).toContain('remainder:agency-details')
    for (const path of productionPaths) expect(verifier).toContain(path)
  })
})
