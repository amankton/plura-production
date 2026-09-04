import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import {
  normalizeB5A2AAgencyDetails,
  normalizeB5A2AQueries,
  normalizeB5A2ATypes,
  verifyB5A2ASourceSnapshot,
  type B5A2ASourceSnapshot,
} from '../../scripts/verify-b5a2a-projections'

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

const entryPaths = [
  'src/app/(main)/agency/page.tsx',
  'src/app/(main)/subaccount/page.tsx',
  'src/app/(main)/agency/[agencyId]/layout.tsx',
  'src/app/(main)/subaccount/[subaccountId]/layout.tsx',
]

const sourcePaths = () =>
  Bun.spawnSync(['git', 'ls-files', 'src']).stdout
    .toString()
    .split(/\r?\n/)
    .filter(Boolean)

const sourceSnapshot = (): B5A2ASourceSnapshot => {
  const paths = sourcePaths()
  return {
    action: read('src/features/agency-projections/actions.ts'),
    agencySettingsPage: read(
      'src/app/(main)/agency/[agencyId]/settings/page.tsx'
    ),
    allSubaccountsPage: read(
      'src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx'
    ),
    createSubaccountButton: read(
      'src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx'
    ),
    detailsConsumerPaths: paths.filter((path) =>
      /<SubAccountDetails\b/.test(read(path))
    ),
    entrySources: entryPaths.map(read),
    menuOptions: read('src/components/sidebar/menu-options.tsx'),
    projectionService: read(
      'src/features/agency-projections/projection-service.ts'
    ),
    serverAdapter: read(
      'src/features/agency-projections/server-projection-service.ts'
    ),
    sidebarIndex: read('src/components/sidebar/index.tsx'),
    sourceText: paths.map(read).join('\n'),
    subaccountSettingsPage: read(
      'src/app/(main)/subaccount/[subaccountId]/settings/page.tsx'
    ),
    types: read('src/lib/types.ts'),
  }
}

const parseSource = (path: string, text: string) =>
  ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )

const declarationNames = (statement: ts.Statement) =>
  ts.isVariableStatement(statement)
    ? statement.declarationList.declarations
        .filter(
          (declaration): declaration is ts.VariableDeclaration & {
            name: ts.Identifier
          } => ts.isIdentifier(declaration.name)
        )
        .map((declaration) => declaration.name.text)
    : []

const replaceStatement = (
  source: string,
  sourceFile: ts.SourceFile,
  statement: ts.Statement,
  index: number
) =>
  source.slice(0, statement.getStart(sourceFile)) +
  `const fixedStatementMutation${index} = ${index}\n` +
  source.slice(statement.end)

const replaceOccurrence = (
  source: string,
  needle: string,
  occurrence: number
) => {
  let offset = 0
  let position = -1
  for (let index = 0; index <= occurrence; index += 1) {
    position = source.indexOf(needle, offset)
    if (position < 0) throw new Error('fixed mutation marker missing')
    offset = position + needle.length
  }
  return (
    source.slice(0, position) +
    `${needle}FixedMutation` +
    source.slice(position + needle.length)
  )
}

describe('B5A2A closed projection surface', () => {
  test('passes the fixed-input verifier and rejects caller-controlled arguments', () => {
    const pass = Bun.spawnSync([
      process.execPath,
      'scripts/verify-b5a2a-projections.ts',
    ])
    expect(pass.exitCode).toBe(0)
    expect(pass.stderr.toString()).toBe('')
    expect(pass.stdout.toString()).toBe(
      'B5A2A_PASS records=14 projections=7 client_actions=1 consumers=3 compatibility_sinks=0 entry_calls=4\n'
    )

    const denied = Bun.spawnSync([
      process.execPath,
      'scripts/verify-b5a2a-projections.ts',
      'unexpected',
    ])
    expect(denied.exitCode).toBe(1)
    expect(denied.stdout.toString()).toBe('')
    expect(denied.stderr.toString()).toBe('B5A2A_FAIL argument-count\n')
  }, 15_000)

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

  test('keeps the frozen account entry exact and the legacy layout chain absent', () => {
    expect(normalizedHash(read('src/features/accounts/actions.ts'))).toBe(
      'e3804c4486b39ae11af2416e3bf7c125d5ad1e702fbd6715b16084ecadda598d'
    )
    expect(entryPaths.map(read).join('\n')).not.toMatch(
      /getNotificationAndUser|legacyActivityActorName/
    )
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

  test('rejects every fixed injected source-boundary mutation', () => {
    const baseline = sourceSnapshot()
    expect(verifyB5A2ASourceSnapshot(baseline)).toEqual([])
    const mutations: Array<Readonly<{
      label: string
      snapshot: B5A2ASourceSnapshot
    }>> = [
      {
        label: 'broad Prisma import',
        snapshot: {
          ...baseline,
          projectionService:
            "import { Agency } from '@prisma/client'\n" +
            baseline.projectionService,
        },
      },
      {
        label: 'any',
        snapshot: {
          ...baseline,
          projectionService: baseline.projectionService + '\ntype Drift = any\n',
        },
      },
      {
        label: 'cast',
        snapshot: {
          ...baseline,
          menuOptions: baseline.menuOptions + '\nconst drift = value as Agency\n',
        },
      },
      {
        label: 'agency object spread',
        snapshot: {
          ...baseline,
          menuOptions:
            baseline.menuOptions + '\nconst drift = <X agencyDetails={{ ...agency }} />\n',
        },
      },
      {
        label: 'broad wrapper',
        snapshot: {
          ...baseline,
          projectionService:
            baseline.projectionService +
            '\ntype Drift = Record<string, unknown>\n',
        },
      },
      {
        label: 'agency settings direct DB',
        snapshot: {
          ...baseline,
          agencySettingsPage:
            "import { db } from '@/lib/db'\n" + baseline.agencySettingsPage,
        },
      },
      {
        label: 'type module direct DB',
        snapshot: {
          ...baseline,
          types: "import { db } from './db'\n" + baseline.types,
        },
      },
      {
        label: 'retired export or caller',
        snapshot: {
          ...baseline,
          sourceText: baseline.sourceText + '\ngetAuthUserDetails()\n',
        },
      },
      {
        label: 'fourth details consumer',
        snapshot: {
          ...baseline,
          detailsConsumerPaths: [
            ...baseline.detailsConsumerPaths,
            'src/fixed-mutation/fourth-consumer.tsx',
          ],
        },
      },
      {
        label: 'third logical name sink',
        snapshot: {
          ...baseline,
          allSubaccountsPage:
            baseline.allSubaccountsPage +
            '\n<X userName={projection.legacyActivityActorName} />\n',
        },
      },
      {
        label: 'fifth entry call',
        snapshot: {
          ...baseline,
          entrySources: [
            ...baseline.entrySources,
            'verifyAndAcceptInvitation()',
          ],
        },
      },
      {
        label: 'second client action',
        snapshot: {
          ...baseline,
          action: baseline.action + '\nexport const driftAction = () => null\n',
        },
      },
      {
        label: 'silent adapter truncation',
        snapshot: {
          ...baseline,
          serverAdapter: baseline.serverAdapter.replace('take: 251', 'take: 250'),
        },
      },
      {
        label: 'unbound assignee relation',
        snapshot: {
          ...baseline,
          serverAdapter: baseline.serverAdapter.replace(
            'Permissions: {',
            'UnboundPermissions: {'
          ),
        },
      },
    ]

    for (const mutation of mutations) {
      expect(
        verifyB5A2ASourceSnapshot(mutation.snapshot).length,
        mutation.label
      ).toBeGreaterThan(0)
    }
  })

  test('rejects non-allowlisted drift in every whole-remainder normalizer', () => {
    const queries = read('src/lib/queries.ts')
    const types = read('src/lib/types.ts')
    const agencyDetails = read('src/components/forms/agency-details.tsx')
    const expected = {
      agencyDetails:
        '385d17bbbfb07034b3fbd14dbfb5a82a1cd877cccd035203012cb82987818143',
      queries:
        '18db1594db66ee1fd85155df581ffb06108c492c16747631d4dab6dda4390d70',
      types:
        'e9a054240ea007d564bd9ff0e33f750822102b0a4586b6d3834795e8e7fb21b2',
    }

    expect(normalizedHash(normalizeB5A2AQueries(queries))).toBe(expected.queries)
    expect(normalizedHash(normalizeB5A2ATypes(types))).toBe(expected.types)
    expect(normalizedHash(normalizeB5A2AAgencyDetails(agencyDetails))).toBe(
      expected.agencyDetails
    )

    expect(
      normalizedHash(
        normalizeB5A2AQueries(
          queries + '\nexport const fixedMutationQuery = () => null\n'
        )
      )
    ).not.toBe(expected.queries)
    expect(
      normalizedHash(
        normalizeB5A2ATypes(types + '\nexport type FixedMutation = string\n')
      )
    ).not.toBe(expected.types)

    for (const marker of [
      'provisionAgencyOwner',
      'upsertAgency',
      '/api/stripe/create-customer',
      'deleteAgency',
      'updateAgencyGoal',
    ]) {
      const mutation = agencyDetails.replace(marker, `${marker}FixedMutation`)
      expect(mutation, marker).not.toBe(agencyDetails)
      expect(
        normalizedHash(normalizeB5A2AAgencyDetails(mutation)),
        marker
      ).not.toBe(expected.agencyDetails)
    }
  })

  test('mutates every protected legacy statement and all 36 retained query exports', () => {
    const fixtures = [
      {
        expected:
          '18db1594db66ee1fd85155df581ffb06108c492c16747631d4dab6dda4390d70',
        ignored: (statement: ts.Statement, sourceFile: ts.SourceFile) =>
          ts.isVariableStatement(statement) &&
          declarationNames(statement).some((name) =>
            [
              'getAuthUserDetails',
              'getNotificationAndUser',
              'getSubAccountTeamMembers',
              'saveActivityLogsNotification',
            ].includes(name)
          ),
        normalize: normalizeB5A2AQueries,
        path: 'src/lib/queries.ts',
      },
      {
        expected:
        'e9a054240ea007d564bd9ff0e33f750822102b0a4586b6d3834795e8e7fb21b2',
        ignored: (statement: ts.Statement, sourceFile: ts.SourceFile) =>
          (ts.isImportDeclaration(statement) &&
            ts.isStringLiteral(statement.moduleSpecifier) &&
            statement.moduleSpecifier.text === './db') ||
          (ts.isVariableStatement(statement) &&
            declarationNames(statement).includes(
              '__getUsersWithAgencySubAccountPermissionsSidebarOptions'
            )) ||
          (ts.isTypeAliasDeclaration(statement) &&
            [
              'AuthUserWithAgencySigebarOptionsSubAccounts',
              'NotificationWithUser',
              'UsersWithAgencySubAccountPermissionsSidebarOptions',
            ].includes(statement.name.text)),
        normalize: normalizeB5A2ATypes,
        path: 'src/lib/types.ts',
      },
      {
        expected:
        '385d17bbbfb07034b3fbd14dbfb5a82a1cd877cccd035203012cb82987818143',
        ignored: (statement: ts.Statement, sourceFile: ts.SourceFile) =>
          ts.isImportDeclaration(statement) &&
          ts.isStringLiteral(statement.moduleSpecifier) &&
          statement.moduleSpecifier.text === '@prisma/client' &&
          statement.importClause?.namedBindings !== undefined &&
          ts.isNamedImports(statement.importClause.namedBindings) &&
          statement.importClause.namedBindings.elements.every(
            (element) => element.name.text === 'Agency'
          ),
        normalize: normalizeB5A2AAgencyDetails,
        path: 'src/components/forms/agency-details.tsx',
      },
    ]

    let retainedQueryExports = 0
    for (const fixture of fixtures) {
      const source = read(fixture.path)
      const sourceFile = parseSource(fixture.path, source)
      const protectedStatements = sourceFile.statements.filter(
        (statement) => !fixture.ignored(statement, sourceFile)
      )
      expect(protectedStatements.length, fixture.path).toBeGreaterThan(0)
      protectedStatements.forEach((statement, index) => {
        if (
          fixture.path === 'src/lib/queries.ts' &&
          ts.isVariableStatement(statement) &&
          statement.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
          )
        ) {
          retainedQueryExports += 1
        }
        const mutation = replaceStatement(source, sourceFile, statement, index)
        expect(
          normalizedHash(fixture.normalize(mutation)),
          `${fixture.path}:${index}`
        ).not.toBe(fixture.expected)
      })
    }
    expect(retainedQueryExports).toBe(36)
  })

  test('mutates every protected AgencyDetails effect, toast, refresh, and error branch', () => {
    const source = read('src/components/forms/agency-details.tsx')
    const expected =
      '385d17bbbfb07034b3fbd14dbfb5a82a1cd877cccd035203012cb82987818143'
    const uniqueMarkers = [
      'provisionAgencyOwner',
      'upsertAgency',
      '/api/stripe/create-customer',
      'Billing setup needs attention',
      "data?.id ? 'Updated Agency' : 'Created Agency'",
      'could not create your agency',
      'deleteAgency',
      'Deleted Agency',
      'Deleted your agency and all subaccounts',
      'could not delete your agency ',
      'setDeletingAgency(false)',
      'updateAgencyGoal',
    ]
    const mutations = uniqueMarkers.map((marker) =>
      replaceOccurrence(source, marker, 0)
    )
    mutations.push(
      replaceOccurrence(source, 'catch (error)', 0),
      replaceOccurrence(source, 'catch (error)', 1),
      replaceOccurrence(source, 'router.refresh()', 0),
      replaceOccurrence(source, 'router.refresh()', 1),
      replaceOccurrence(source, 'router.refresh()', 2),
      replaceOccurrence(source, "variant: 'destructive'", 0),
      replaceOccurrence(source, "variant: 'destructive'", 1),
      replaceOccurrence(source, "variant: 'destructive'", 2)
    )

    expect(mutations).toHaveLength(20)
    mutations.forEach((mutation, index) => {
      expect(
        normalizedHash(normalizeB5A2AAgencyDetails(mutation)),
        `agency-effect:${index}`
      ).not.toBe(expected)
    })
  })
})
