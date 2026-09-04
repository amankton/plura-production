import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'
import { Role } from '@prisma/client'
import ts from 'typescript'
import { AccessError } from '@/lib/auth/access-error'
import type { AgencyContext } from '@/lib/auth/agency-context'
import type { TenantContext } from '@/lib/auth/tenant-context'
import {
  b5a2bLegacyControlNodeHashes,
  b5a2bWriterPaths,
  verifyLegacyControlSnapshot,
  verifyB5A2BSourceSnapshot,
  verifyProtectedCandidateSnapshot,
  verifyWriterRetirementSnapshot,
  type B5A2BSourceSnapshot,
} from '../../scripts/verify-b5a2b-notification-boundary'

const root = process.cwd()

const walk = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })

const sourceFiles = walk(join(root, 'src')).filter((path) => /\.tsx?$/.test(path))
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const readParent = (path: string) => {
  const result = Bun.spawnSync([
    'git',
    'show',
    `7f236cbba1281c0bdaccbfa6770fcc0c128a4f80:${path}`,
  ])
  if (result.exitCode !== 0) throw new Error('parent fixture unavailable')
  return result.stdout.toString()
}
const sourceHash = (value: string) =>
  createHash('sha256')
    .update(value.replaceAll('\r\n', '\n'))
    .digest('hex')

const replaceOccurrence = (
  source: string,
  needle: string,
  occurrence: number,
  replacement = `${needle}Drift`
) => {
  let offset = 0
  let position = -1
  for (let index = 0; index <= occurrence; index += 1) {
    position = source.indexOf(needle, offset)
    if (position < 0) throw new Error('mutation marker unavailable')
    offset = position + needle.length
  }
  return (
    source.slice(0, position) +
    replacement +
    source.slice(position + needle.length)
  )
}

const agencyContext = (role: Role): AgencyContext => ({
  actor: {
    id: 'actor-a',
    providerSubject: 'provider-a',
    role,
  },
  agencyId: 'agency-a',
})

const tenantContext = (role: Role): TenantContext => ({
  actor: {
    id: 'actor-a',
    providerSubject: 'provider-a',
    role,
  },
  agencyId: 'agency-a',
  correlationId: 'correlation-a',
  scope: { subaccountIds: ['subaccount-a'] },
  subaccountId: 'subaccount-a',
})

let resolvedAgencyContext = agencyContext(Role.AGENCY_OWNER)
let resolvedTenantContext = tenantContext(Role.SUBACCOUNT_USER)
let agencyResolutionError: AccessError | null = null
let tenantResolutionError: AccessError | null = null
let queryError: Error | null = null
const notificationQueries: unknown[] = []

mock.module('server-only', () => ({}))
mock.module('@/lib/db', () => ({
  db: {
    notification: {
      findMany: async (query: unknown) => {
        notificationQueries.push(query)
        if (queryError) throw queryError
        return []
      },
    },
  },
}))
mock.module('@/lib/auth/server-agency-context', () => ({
  getAgencyContext: async () => {
    if (agencyResolutionError) throw agencyResolutionError
    return resolvedAgencyContext
  },
}))
mock.module('@/lib/auth/server-tenant-context', () => ({
  getTenantContext: async () => {
    if (tenantResolutionError) throw tenantResolutionError
    return resolvedTenantContext
  },
}))

let serverViewService: typeof import('../../src/features/notifications/server-notification-view-service')['notificationViewService']

beforeAll(async () => {
  const module = await import(
    '../../src/features/notifications/server-notification-view-service'
  )
  serverViewService = module.notificationViewService
})

beforeEach(() => {
  resolvedAgencyContext = agencyContext(Role.AGENCY_OWNER)
  resolvedTenantContext = tenantContext(Role.SUBACCOUNT_USER)
  agencyResolutionError = null
  tenantResolutionError = null
  queryError = null
  notificationQueries.length = 0
})

const sourceSnapshot = (): B5A2BSourceSnapshot => ({
  activityFoundation: read(
    'src/features/notifications/activity-foundation-service.ts'
  ),
  agencyLayout: read('src/app/(main)/agency/[agencyId]/layout.tsx'),
  infoBar: read('src/components/global/infobar.tsx'),
  notificationView: read(
    'src/features/notifications/notification-view-service.ts'
  ),
  serverView: read(
    'src/features/notifications/server-notification-view-service.ts'
  ),
  sourceText: sourceFiles.map((path) => readFileSync(path, 'utf8')).join('\n'),
  subaccountLayout: read(
    'src/app/(main)/subaccount/[subaccountId]/layout.tsx'
  ),
})

describe('B5A2B notification surface', () => {
  test('executes owner and admin agency reads only after policy resolution', async () => {
    for (const role of [Role.AGENCY_OWNER, Role.AGENCY_ADMIN]) {
      resolvedAgencyContext = agencyContext(role)
      const result = await serverViewService.getAgencyFeed('agency-a')
      expect(result).toEqual({ notifications: [], viewerRole: role })
      expect(notificationQueries).toHaveLength(1)
      expect(notificationQueries[0]).toMatchObject({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 101,
        where: {
          agencyId: 'agency-a',
          User: { agencyId: 'agency-a' },
        },
      })
      notificationQueries.length = 0
    }
  })

  test('branches owner/admin subaccount views to agency scope and restricted roles to exact scope', async () => {
    for (const role of [Role.AGENCY_OWNER, Role.AGENCY_ADMIN]) {
      resolvedTenantContext = tenantContext(role)
      const result = await serverViewService.getSubaccountFeed('subaccount-a')
      expect(result.viewerRole).toBe(role)
      expect(notificationQueries).toHaveLength(1)
      expect(notificationQueries[0]).toMatchObject({
        where: {
          agencyId: 'agency-a',
          User: { agencyId: 'agency-a' },
        },
      })
      expect(notificationQueries[0]).not.toMatchObject({
        where: { subAccountId: 'subaccount-a' },
      })
      notificationQueries.length = 0
    }

    for (const role of [Role.SUBACCOUNT_USER, Role.SUBACCOUNT_GUEST]) {
      resolvedTenantContext = tenantContext(role)
      const result = await serverViewService.getSubaccountFeed('subaccount-a')
      expect(result.viewerRole).toBe(role)
      expect(notificationQueries).toHaveLength(1)
      expect(notificationQueries[0]).toMatchObject({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 101,
        where: {
          agencyId: 'agency-a',
          subAccountId: 'subaccount-a',
          SubAccount: { agencyId: 'agency-a', id: 'subaccount-a' },
          User: { agencyId: 'agency-a' },
        },
      })
      notificationQueries.length = 0
    }
  })

  test('denies unresolved or disallowed actors before either notification query', async () => {
    resolvedAgencyContext = agencyContext(Role.SUBACCOUNT_USER)
    await expect(
      serverViewService.getAgencyFeed('agency-a')
    ).rejects.toBeInstanceOf(AccessError)
    expect(notificationQueries).toEqual([])

    agencyResolutionError = new AccessError('UNAUTHENTICATED')
    await expect(
      serverViewService.getAgencyFeed('agency-a')
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(notificationQueries).toEqual([])

    tenantResolutionError = new AccessError('FORBIDDEN')
    await expect(
      serverViewService.getSubaccountFeed('subaccount-a')
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(notificationQueries).toEqual([])

    tenantResolutionError = null
    Reflect.set(resolvedTenantContext.actor, 'role', 'UNKNOWN')
    await expect(
      serverViewService.getSubaccountFeed('subaccount-a')
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(notificationQueries).toEqual([])
  })

  test('contains adapter failures behind the finite conflict contract', async () => {
    queryError = new Error('database-detail')
    await expect(
      serverViewService.getAgencyFeed('agency-a')
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(notificationQueries).toHaveLength(1)

    notificationQueries.length = 0
    await expect(
      serverViewService.getSubaccountFeed('subaccount-a')
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(notificationQueries).toHaveLength(1)
  })

  test('retires both legacy exports and the complete temporary name chain', () => {
    const source = sourceFiles.map((path) => readFileSync(path, 'utf8')).join('\n')
    for (const retired of [
      'getNotificationAndUser',
      'saveActivityLogsNotification',
      'legacyActivityActorName',
      'listLegacyActorNames',
      'getLegacyActorName',
      'includeLegacyName',
    ]) {
      expect(source.includes(retired)).toBe(false)
    }
    expect(/\buserName\b/.test(source)).toBe(false)
  })

  test('keeps the activity foundation unreachable from production', () => {
    const importers = sourceFiles.filter((path) => {
      const normalized = relative(root, path).replaceAll('\\', '/')
      return normalized !==
        'src/features/notifications/activity-foundation-service.ts' &&
        readFileSync(path, 'utf8').includes('activity-foundation-service')
    })
    expect(importers).toEqual([])

    const source = sourceFiles.map((path) => readFileSync(path, 'utf8')).join('\n')
    expect(/db\.notification\.(create|createMany|update|upsert)/.test(source)).toBe(
      false
    )
    expect(source.includes('FOUNDATION_VALIDATION_ONLY')).toBe(false)
  })

  test('binds the two server-only persistence predicates and fixed bound', () => {
    const source = read(
      'src/features/notifications/server-notification-view-service.ts'
    )
    expect(source.startsWith("import 'server-only'")).toBe(true)
    expect((source.match(/take: 101/g) ?? []).length).toBe(2)
    expect(
      (
        source.match(
          /orderBy: \[\{ createdAt: 'desc' \}, \{ id: 'desc' \}\]/g
        ) ?? []
      ).length
    ).toBe(2)
    expect(source.includes('subAccountId: subaccountId')).toBe(true)
    expect(source.includes('User: { agencyId }')).toBe(true)
    expect(source.includes("const agencyAction = 'notification:view-agency'")).toBe(
      true
    )
  })

  test('has exactly the three declared production modules', () => {
    const files = readdirSync(join(root, 'src/features/notifications')).sort()
    expect(files).toEqual([
      'activity-foundation-service.ts',
      'notification-view-service.ts',
      'server-notification-view-service.ts',
    ])
  })

  test('passes the fixed verifier and rejects arguments', () => {
    const pass = Bun.spawnSync([
      process.execPath,
      'scripts/verify-b5a2b-notification-boundary.ts',
    ])
    expect(pass.exitCode).toBe(0)
    expect(pass.stderr.toString()).toBe('')
    expect(pass.stdout.toString()).toBe(
      'B5A2B_PASS records=2 readers=2 writer_imports=16 writer_calls=18 legacy_files=8 feed_limit=100 production_events=0\n'
    )

    const denied = Bun.spawnSync([
      process.execPath,
      'scripts/verify-b5a2b-notification-boundary.ts',
      'unexpected',
    ])
    expect(denied.exitCode).toBe(1)
    expect(denied.stdout.toString()).toBe('')
    expect(denied.stderr.toString()).toBe('B5A2B_FAIL argument-count\n')
  }, 15_000)

  test('rejects fixed authority, DTO, reachability, and policy mutations', () => {
    const baseline = sourceSnapshot()
    expect(verifyB5A2BSourceSnapshot(baseline)).toEqual([])
    const mutations: Array<Readonly<{
      label: string
      snapshot: B5A2BSourceSnapshot
    }>> = [
      {
        label: 'legacy alias',
        snapshot: {
          ...baseline,
          sourceText: `${baseline.sourceText}\ngetNotificationAndUser()`,
        },
      },
      {
        label: 'foundation importer',
        snapshot: {
          ...baseline,
          sourceText:
            `${baseline.sourceText}\n` +
            "import { createActivityFoundationService } from '@/features/notifications/activity-foundation-service'",
        },
      },
      {
        label: 'notification write',
        snapshot: {
          ...baseline,
          sourceText: `${baseline.sourceText}\ndb.notification.create({})`,
        },
      },
      {
        label: 'broad type',
        snapshot: {
          ...baseline,
          notificationView: `${baseline.notificationView}\ntype Drift = any`,
        },
      },
      {
        label: 'raw log',
        snapshot: {
          ...baseline,
          serverView: `${baseline.serverView}\nconsole.error('drift')`,
        },
      },
      {
        label: 'extra runtime export',
        snapshot: {
          ...baseline,
          notificationView:
            `${baseline.notificationView}\nexport const drift = () => null`,
        },
      },
      {
        label: 'server-only removed',
        snapshot: {
          ...baseline,
          serverView: baseline.serverView.replace("import 'server-only'", ''),
        },
      },
      {
        label: 'silent truncation',
        snapshot: {
          ...baseline,
          serverView: baseline.serverView.replace('take: 101', 'take: 100'),
        },
      },
      {
        label: 'unstable order',
        snapshot: {
          ...baseline,
          serverView: baseline.serverView.replace(
            "orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]",
            "orderBy: [{ createdAt: 'desc' }]"
          ),
        },
      },
      {
        label: 'caller action',
        snapshot: {
          ...baseline,
          serverView: `${baseline.serverView}\nconst requestedAction = input.action`,
        },
      },
      {
        label: 'reader bypass',
        snapshot: {
          ...baseline,
          subaccountLayout: baseline.subaccountLayout.replace(
            'notificationViewService.getSubaccountFeed(',
            'notificationViewService.getAgencyFeed('
          ),
        },
      },
      {
        label: 'HTML rendering',
        snapshot: {
          ...baseline,
          infoBar: `${baseline.infoBar}\n<div dangerouslySetInnerHTML={{}} />`,
        },
      },
      {
        label: 'foundation runtime import',
        snapshot: {
          ...baseline,
          activityFoundation:
            "import { db } from '@/lib/db'\n" + baseline.activityFoundation,
        },
      },
      {
        label: 'production event',
        snapshot: {
          ...baseline,
          activityFoundation:
            `${baseline.activityFoundation}\nconst event = 'AGENCY_UPDATED'`,
        },
      },
      {
        label: 'input key drift',
        snapshot: {
          ...baseline,
          activityFoundation: baseline.activityFoundation.replace(
            "['context', 'event', 'label', 'receipt']",
            "['context', 'event', 'message', 'receipt']"
          ),
        },
      },
    ]

    for (const mutation of mutations) {
      expect(
        verifyB5A2BSourceSnapshot(mutation.snapshot).length,
        mutation.label
      ).toBeGreaterThan(0)
    }

    const viewPolicyOccurrences = [
      ['Role.AGENCY_OWNER', 0],
      ['Role.AGENCY_OWNER', 1],
      ['Role.AGENCY_ADMIN', 0],
      ['Role.AGENCY_ADMIN', 1],
      ['Role.SUBACCOUNT_USER', 0],
      ['Role.SUBACCOUNT_GUEST', 0],
      ["'notification:view-agency'", 0],
      ["'notification:view-agency'", 1],
      ["'notification:view-agency'", 2],
      ["'notification:view-subaccount'", 0],
      ["'notification:view-subaccount'", 1],
    ] as const
    for (const [needle, occurrence] of viewPolicyOccurrences) {
      const replacement = needle.startsWith("'notification:")
        ? `${needle.slice(0, -1)}-drift'`
        : `${needle}Drift`
      const snapshot = {
        ...baseline,
        notificationView: replaceOccurrence(
          baseline.notificationView,
          needle,
          occurrence,
          replacement
        ),
      }
      expect(
        verifyB5A2BSourceSnapshot(snapshot).length,
        `view-policy:${needle}:${occurrence}`
      ).toBeGreaterThan(0)
    }

    for (const [needle, occurrences] of [
      ["const action = 'notification:view-agency'", 1],
      ["const subaccountAction = 'notification:view-subaccount'", 1],
      ["const agencyAction = 'notification:view-agency'", 1],
      ['assertAgencyOperator(context)', 1],
      ['assertNotificationViewAction(', 3],
    ] as const) {
      for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
        const snapshot = {
          ...baseline,
          serverView: replaceOccurrence(
            baseline.serverView,
            needle,
            occurrence
          ),
        }
        expect(
          verifyB5A2BSourceSnapshot(snapshot).length,
          `server-policy:${needle}:${occurrence}`
        ).toBeGreaterThan(0)
      }
    }
  })

  test('independently rejects all 16 legacy imports and all 18 legacy calls', () => {
    const parent = Object.fromEntries(
      b5a2bWriterPaths.map((path) => [path, readParent(path)])
    )
    const candidate = Object.fromEntries(
      b5a2bWriterPaths.map((path) => [path, read(path)])
    )
    expect(verifyWriterRetirementSnapshot(parent, candidate)).toEqual([])

    let callMutations = 0
    for (const path of b5a2bWriterPaths) {
      const importMutation = {
        ...parent,
        [path]: replaceOccurrence(
          parent[path],
          'saveActivityLogsNotification',
          0
        ),
      }
      expect(
        verifyWriterRetirementSnapshot(importMutation, candidate).length,
        `writer-import:${path}`
      ).toBeGreaterThan(0)

      const calls =
        parent[path].match(/saveActivityLogsNotification\s*\(/g)?.length ?? 0
      for (let occurrence = 0; occurrence < calls; occurrence += 1) {
        callMutations += 1
        const callMutation = {
          ...parent,
          [path]: replaceOccurrence(
            parent[path],
            'saveActivityLogsNotification(',
            occurrence,
            'saveActivityLogsNotificationDrift('
          ),
        }
        expect(
          verifyWriterRetirementSnapshot(callMutation, candidate).length,
          `writer-call:${path}:${occurrence}`
        ).toBeGreaterThan(0)
      }
    }
    expect(callMutations).toBe(18)
  })

  test('mutates every protected writer statement and call', () => {
    let statements = 0
    let calls = 0
    for (const path of b5a2bWriterPaths) {
      const source = read(path)
      expect(verifyProtectedCandidateSnapshot({ [path]: source })).toEqual([])
      const sourceFile = ts.createSourceFile(
        path,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      )
      for (const statement of sourceFile.statements) {
        statements += 1
        const mutation =
          source.slice(0, statement.getStart(sourceFile)) +
          `const protectedStatementDrift${statements} = ${statements}\n` +
          source.slice(statement.end)
        expect(
          verifyProtectedCandidateSnapshot({ [path]: mutation }),
          `statement:${path}:${statements}`
        ).not.toEqual([])
      }
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          calls += 1
          const mutation =
            source.slice(0, node.getStart(sourceFile)) +
            `protectedCallDrift${calls}()` +
            source.slice(node.end)
          expect(
            verifyProtectedCandidateSnapshot({ [path]: mutation }),
            `call:${path}:${calls}`
          ).not.toEqual([])
        }
        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
    }
    expect(statements).toBeGreaterThan(100)
    expect(calls).toBeGreaterThan(100)
  })

  test('binds and independently mutates all six privileged-name parent controls', () => {
    const parent = readParent(
      'src/features/agency-projections/projection-service.ts'
    )
    const candidate = read(
      'src/features/agency-projections/projection-service.ts'
    )
    expect(verifyLegacyControlSnapshot(parent, candidate)).toEqual([])
    const sourceFile = ts.createSourceFile(
      'projection-service.ts',
      parent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
    const nodes: ts.Node[] = []
    const visit = (node: ts.Node) => {
      nodes.push(node)
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)

    for (const expected of b5a2bLegacyControlNodeHashes) {
      const node = nodes.find(
        (candidateNode) =>
          sourceHash(candidateNode.getText(sourceFile)) === expected
      )
      expect(node, expected).toBeDefined()
      if (!node) continue
      const mutation =
        parent.slice(0, node.getStart(sourceFile)) +
        'void 0' +
        parent.slice(node.end)
      expect(
        verifyLegacyControlSnapshot(mutation, candidate),
        expected
      ).not.toEqual([])
    }
  })
})
