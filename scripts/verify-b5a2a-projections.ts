import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const IMPLEMENTATION_PARENT = 'bbe5ec82a8184c21fc0d09f767891c5dc7f08534'
const REMEDIATION_CANDIDATE = '7832c703ddbc2d527d83b2a810d8f6890db9fdca'
const EVIDENCE_PATH =
  'docs/evidence/CF-P1-B5A2A-candidate-verification.json'
const EXECUTION_PATH = 'docs/execution/CF-P1-B5A2A-actor-safe-projections.md'
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })

const allowedPaths = new Set([
  'docs/evidence/CF-P1-B5A2A-candidate-verification.json',
  'docs/execution/CF-P1-B5A2A-actor-safe-projections.md',
  'docs/issues/CF-P1-B5A2A-actor-safe-projections.md',
  'docs/issues/CF-P1-B5A2B-notification-activity-boundary.md',
  'docs/evidence/CF-P1-B5A2B-candidate-verification.json',
  'docs/execution/CF-P1-B5A2B-notification-activity-boundary.md',
  'docs/security/agency-authority/inventory.json',
  'docs/security/agency-authority/inventory.lock.json',
  'scripts/agency-authority-inventory-lib.ts',
  'scripts/verify-b5a2a-projections.ts',
  'scripts/verify-b5a2b-notification-boundary.ts',
  'src/app/(main)/agency/[agencyId]/all-subaccounts/_components/delete-button.tsx',
  'src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx',
  'src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx',
  'src/app/(main)/agency/[agencyId]/layout.tsx',
  'src/app/(main)/agency/[agencyId]/settings/page.tsx',
  'src/app/(main)/agency/page.tsx',
  'src/app/(main)/subaccount/[subaccountId]/settings/page.tsx',
  'src/app/(main)/subaccount/[subaccountId]/layout.tsx',
  'src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/_components/funnel-products-table.tsx',
  'src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/_components/funnel-editor-navigation.tsx',
  'src/app/(main)/subaccount/[subaccountId]/pipelines/_components/pipeline-lane.tsx',
  'src/app/(main)/subaccount/[subaccountId]/pipelines/_components/pipeline-ticket.tsx',
  'src/app/(main)/subaccount/page.tsx',
  'src/components/forms/agency-details.tsx',
  'src/components/forms/contact-user-form.tsx',
  'src/components/forms/create-pipeline-form.tsx',
  'src/components/forms/funnel-form.tsx',
  'src/components/forms/funnel-page.tsx',
  'src/components/forms/lane-form.tsx',
  'src/components/forms/subaccount-details.tsx',
  'src/components/forms/ticket-form.tsx',
  'src/components/forms/upload-media.tsx',
  'src/components/global/infobar.tsx',
  'src/components/global/tag-creator.tsx',
  'src/components/media/media-card.tsx',
  'src/components/sidebar/index.tsx',
  'src/components/sidebar/menu-options.tsx',
  'src/features/agency-projections/actions.ts',
  'src/features/agency-projections/projection-service.ts',
  'src/features/agency-projections/server-projection-service.ts',
  'src/features/notifications/activity-foundation-service.ts',
  'src/features/notifications/notification-view-service.ts',
  'src/features/notifications/server-notification-view-service.ts',
  'src/lib/queries.ts',
  'src/lib/types.ts',
  'tests/agency-projections/projection-service.test.ts',
  'tests/agency-projections/projection-surface.test.ts',
  'tests/authority-inventory/agency-authority-inventory.test.ts',
  'tests/notifications/activity-foundation.test.ts',
  'tests/notifications/notification-surface.test.ts',
  'tests/notifications/notification-view-service.test.ts',
])

const normalize = (value: string) => value.replaceAll('\r\n', '\n')
const digest = (value: string) =>
  createHash('sha256').update(normalize(value)).digest('hex')
const read = (path: string) => readFileSync(join(repositoryRoot, path), 'utf8')

const readParent = (path: string) => {
  const result = Bun.spawnSync([
    'git',
    'show',
    `${IMPLEMENTATION_PARENT}:${path}`,
  ], { cwd: repositoryRoot })
  if (result.exitCode !== 0) throw new Error('parent-read')
  return result.stdout.toString()
}

const parse = (path: string, text = read(path)) =>
  ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )

const nodeDigest = (node: ts.Node, sourceFile: ts.SourceFile) =>
  digest(node.getText(sourceFile))

const descendants = (sourceFile: ts.SourceFile) => {
  const nodes: ts.Node[] = []
  const visit = (node: ts.Node) => {
    nodes.push(node)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return nodes
}

const namedVariableStatement = (sourceFile: ts.SourceFile, name: string) => {
  const matches = descendants(sourceFile).filter(
    (node): node is ts.VariableStatement =>
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) && declaration.name.text === name
      )
  )
  if (matches.length !== 1) throw new Error(`variable:${name}`)
  return matches[0]
}

const namedFunctionDeclaration = (sourceFile: ts.SourceFile, name: string) => {
  const matches = descendants(sourceFile).filter(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === name
  )
  if (matches.length !== 1) throw new Error(`function:${name}`)
  return matches[0]
}

const callExpressions = (sourceFile: ts.SourceFile, expression: string) =>
  descendants(sourceFile).filter(
    (node): node is ts.CallExpression =>
      ts.isCallExpression(node) &&
      node.expression.getText(sourceFile) === expression
  )

const assertDigest = (
  errors: string[],
  name: string,
  actual: string,
  expected: string
) => {
  if (actual !== expected) errors.push(`${name}:hash`)
}

const removeNamedVariables = (
  sourceFile: ts.SourceFile,
  names: readonly string[]
) =>
  ts.factory.updateSourceFile(
    sourceFile,
    sourceFile.statements.filter(
      (statement) =>
        !(
          ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.some(
            (declaration) =>
              ts.isIdentifier(declaration.name) &&
              names.includes(declaration.name.text)
          )
        )
    )
  )

export const normalizeB5A2AQueries = (text: string) => {
  const sourceFile = parse('src/lib/queries.ts', text)
  return normalize(
    printer.printFile(
      removeNamedVariables(sourceFile, [
        'getAuthUserDetails',
        'getSubAccountTeamMembers',
        'getNotificationAndUser',
        'saveActivityLogsNotification',
      ])
    )
  )
}

export const normalizeB5A2ATypes = (text: string) => {
  const sourceFile = parse('src/lib/types.ts', text)
  const statements: ts.Statement[] = []
  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === '@prisma/client' &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      const bindings = statement.importClause.namedBindings.elements.filter(
        (element) => element.name.text !== 'Notification'
      )
      statements.push(
        ts.factory.updateImportDeclaration(
          statement,
          statement.modifiers,
          ts.factory.updateImportClause(
            statement.importClause,
            statement.importClause.isTypeOnly,
            statement.importClause.name,
            ts.factory.updateNamedImports(
              statement.importClause.namedBindings,
              bindings
            )
          ),
          statement.moduleSpecifier,
          statement.attributes
        )
      )
      continue
    }
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === './db'
    ) continue
    if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text ===
            '__getUsersWithAgencySubAccountPermissionsSidebarOptions'
      )
    ) continue
    if (
      ts.isTypeAliasDeclaration(statement) &&
      [
        'AuthUserWithAgencySigebarOptionsSubAccounts',
        'NotificationWithUser',
        'UsersWithAgencySubAccountPermissionsSidebarOptions',
      ].includes(statement.name.text)
    ) continue
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === './queries' &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      const bindings = statement.importClause.namedBindings.elements.filter(
        (element) => element.name.text !== 'getAuthUserDetails'
      )
      statements.push(
        ts.factory.updateImportDeclaration(
          statement,
          statement.modifiers,
          ts.factory.updateImportClause(
            statement.importClause,
            statement.importClause.isTypeOnly,
            statement.importClause.name,
            ts.factory.updateNamedImports(
              statement.importClause.namedBindings,
              bindings
            )
          ),
          statement.moduleSpecifier,
          statement.attributes
        )
      )
      continue
    }
    statements.push(statement)
  }
  return normalize(
    printer.printFile(ts.factory.updateSourceFile(sourceFile, statements))
  )
}

export const normalizeB5A2AAgencyDetails = (text: string) => {
  const sourceFile = parse('src/components/forms/agency-details.tsx', text)
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === '@prisma/client' &&
        node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings)
      ) {
        const bindings = node.importClause.namedBindings.elements.filter(
          (element) => element.name.text !== 'Agency'
        )
        if (bindings.length === 0) return undefined
        return ts.factory.updateImportDeclaration(
          node,
          node.modifiers,
          ts.factory.updateImportClause(
            node.importClause,
            node.importClause.isTypeOnly,
            node.importClause.name,
            ts.factory.updateNamedImports(
              node.importClause.namedBindings,
              bindings
            )
          ),
          node.moduleSpecifier,
          node.attributes
        )
      }
      if (ts.isTypeAliasDeclaration(node) && node.name.text === 'Props') {
        const type = node.type
        if (!ts.isTypeLiteralNode(type)) throw new Error('agency-props')
        const members = type.members.map((member) => {
          if (
            ts.isPropertySignature(member) &&
            member.name.getText(sourceFile) === 'data'
          ) {
            return ts.factory.updatePropertySignature(
              member,
              member.modifiers,
              member.name,
              member.questionToken,
              ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)
            )
          }
          return member
        })
        return ts.factory.updateTypeAliasDeclaration(
          node,
          node.modifiers,
          node.name,
          node.typeParameters,
          ts.factory.updateTypeLiteralNode(
            type,
            ts.factory.createNodeArray(members)
          )
        )
      }
      return ts.visitEachChild(node, visit, context)
    }
    return (node) => {
      const result = ts.visitNode(node, visit)
      if (!result || !ts.isSourceFile(result)) {
        throw new Error('agency-transform')
      }
      return result
    }
  }
  const transformed = ts.transform(sourceFile, [transformer])
  try {
    return normalize(printer.printFile(transformed.transformed[0]))
  } finally {
    transformed.dispose()
  }
}

const exactAgencyPurposeFields = [
  'address',
  'agencyLogo',
  'city',
  'companyEmail',
  'companyPhone',
  'country',
  'goal',
  'id',
  'name',
  'state',
  'whiteLabel',
  'zipCode',
]

const expectedClosureLedger = [
  ['internal-only:src/app/(main)/agency/[agencyId]/settings/page.tsx#$db', 'sha256:6325f8b04cfc0fa56d8e85bd5707a425480f6e0be4a79343ce1841ebde6e0d48'],
  ['internal-only:src/app/(main)/subaccount/[subaccountId]/settings/page.tsx#$db', 'sha256:aa7de29c77676c90e1284f8ef07739c20234778a2d6439031018181377822944'],
  ['internal-only:src/lib/types.ts#__getUsersWithAgencySubAccountPermissionsSidebarOptions', 'sha256:57ee01f9500436294b413fda64c86b45693f4780bdb543897b5d4272cbdfcd74'],
  ['internal-only:src/lib/types.ts#$db', 'sha256:57ee01f9500436294b413fda64c86b45693f4780bdb543897b5d4272cbdfcd74'],
  ['layout loader:src/app/(main)/agency/[agencyId]/layout.tsx#default', 'sha256:60e507efcdb0ffc6df440afdd31d81ab48aaea15a36ece960ca5100525d63525'],
  ['layout loader:src/app/(main)/subaccount/[subaccountId]/layout.tsx#default', 'sha256:d12f84b0abbee14d4fd62013cc765941381287b810b7e2c5e8974b9cdd8db08d'],
  ['page loader:src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx#default', 'sha256:96ab560857c70226dab4a32e54b932dbd995ac12b7511aa2ef694842df863c54'],
  ['page loader:src/app/(main)/agency/[agencyId]/settings/page.tsx#default', 'sha256:6325f8b04cfc0fa56d8e85bd5707a425480f6e0be4a79343ce1841ebde6e0d48'],
  ['page loader:src/app/(main)/agency/page.tsx#default', 'sha256:e2cdf414c3bf1c82f0a8359b5f9cabd51b3d7a53dc1d7ee9a5f1c4ec8ea7f1e8'],
  ['page loader:src/app/(main)/subaccount/[subaccountId]/settings/page.tsx#default', 'sha256:aa7de29c77676c90e1284f8ef07739c20234778a2d6439031018181377822944'],
  ['page loader:src/app/(main)/subaccount/page.tsx#default', 'sha256:03cc81898f7eea3e7da544e19976849825c8d4602ba530f0f06f5e53831aa95b'],
  ['provider callback:src/app/(main)/agency/page.tsx#$provider:clerk.currentUser', 'sha256:e2cdf414c3bf1c82f0a8359b5f9cabd51b3d7a53dc1d7ee9a5f1c4ec8ea7f1e8'],
  ['server action:src/lib/queries.ts#getAuthUserDetails', 'sha256:9629a2bc0d55baafc00f6d0b80d7327ac37719fc2f367a0cdab5573456b0c4c2'],
  ['server action:src/lib/queries.ts#getSubAccountTeamMembers', 'sha256:9629a2bc0d55baafc00f6d0b80d7327ac37719fc2f367a0cdab5573456b0c4c2'],
] as const

type CandidateEvidence = Readonly<{
  candidateSha: string
  closureLedger: ReadonlyArray<
    Readonly<{
      disposition: string
      replacement: string
      sourceHash: string
      surfaceId: string
    }>
  >
  format: string
  inventory: Readonly<{ manifestHash: string; records: number }>
  parentSha: string
  projectionSourceHashes: Readonly<Record<string, string>>
  rollback: Readonly<Record<string, string>>
  surfaceCounts: Readonly<Record<string, number>>
  verification: Readonly<{
    boundedCollectionCases: number
    commands: ReadonlyArray<
      Readonly<{ exitStatus: number; name: string; result: string }>
    >
  }>
  zeroUse: Readonly<Record<string, boolean>>
}>

const readCandidateEvidence = () =>
  JSON.parse(read(EVIDENCE_PATH)) as CandidateEvidence

const verifyCandidateEvidence = (errors: string[]) => {
  const evidence = readCandidateEvidence()
  if (evidence.format !== 'Crewframe B5A2A candidate verification v1') {
    errors.push('evidence:format')
  }
  if (evidence.parentSha !== IMPLEMENTATION_PARENT) errors.push('evidence:parent')
  if (evidence.candidateSha !== REMEDIATION_CANDIDATE) {
    errors.push('evidence:candidate')
  }
  const candidateExists = Bun.spawnSync(
    ['git', 'cat-file', '-e', `${REMEDIATION_CANDIDATE}^{commit}`],
    { cwd: repositoryRoot }
  )
  if (candidateExists.exitCode !== 0) errors.push('evidence:candidate-missing')

  const actualLedger = evidence.closureLedger
    .map((record) => `${record.surfaceId}|${record.sourceHash}`)
    .sort()
  const expectedLedger = expectedClosureLedger
    .map(([surfaceId, sourceHash]) => `${surfaceId}|${sourceHash}`)
    .sort()
  if (
    actualLedger.length !== 14 ||
    new Set(actualLedger).size !== 14 ||
    actualLedger.join('\n') !== expectedLedger.join('\n')
  ) {
    errors.push('evidence:closure-ledger')
  }
  if (
    evidence.closureLedger.some(
      (record) => !record.disposition || !record.replacement
    )
  ) {
    errors.push('evidence:closure-description')
  }

  const expectedCommands = [
    'projectionVerifier',
    'inventoryVerifier',
    'focusedTests',
    'fullTests',
    'lint',
    'typecheck',
    'build',
    'frozenOfflineInstall',
    'diffAndAllowlist',
    'boundedScopeScans',
  ]
  if (
    evidence.verification.commands.map((command) => command.name).join('|') !==
      expectedCommands.join('|') ||
    evidence.verification.commands.some(
      (command) =>
        command.exitStatus !== 0 || !command.result.startsWith('PASS')
    )
  ) {
    errors.push('evidence:commands')
  }

  const expectedCounts: Readonly<Record<string, number>> = {
    accountEntryCalls: 4,
    boundedCollectionCases: 8,
    clientActions: 1,
    compatibilitySinks: 2,
    detailsConsumers: 3,
    inventoryAfter: 228,
    ownedLedgerRecords: 14,
    projections: 7,
  }
  const combinedCounts: Readonly<Record<string, number>> = {
    ...evidence.surfaceCounts,
    boundedCollectionCases: evidence.verification.boundedCollectionCases,
  }
  for (const [name, value] of Object.entries(expectedCounts)) {
    if (combinedCounts[name] !== value) errors.push(`evidence:count:${name}`)
  }

  const expectedSourceHashes: Readonly<Record<string, string>> = {
    clientAction:
      'sha256:30a1f48c70f75a7dd0d8312189cfe1e2ba7a50f85af0f17a2794a55d1c2285d8',
    projectionService:
      'sha256:df15a0a9cf9a216119182571b1f494308aa11dbf1ad28bf5fa6fb72eb34a2541',
    serverAdapter:
      'sha256:3bef7ee8c4519bf30256b82e717a4c2ab40e98c55e2f2a4f26f70edf5f9f7c08',
  }
  for (const [name, value] of Object.entries(expectedSourceHashes)) {
    if (evidence.projectionSourceHashes[name] !== value) {
      errors.push(`evidence:source-hash:${name}`)
    }
  }

  if (
    evidence.inventory.records !== 228 ||
    evidence.inventory.manifestHash !==
      'sha256:c1e088fd578e83ff9e83effe72f8dd64c0063be2ceee17a00ac42ed91b80ac48'
  ) {
    errors.push('evidence:inventory')
  }
  if (
    Object.keys(evidence.zeroUse).length !== 11 ||
    Object.values(evidence.zeroUse).some((value) => value !== false)
  ) {
    errors.push('evidence:zero-use')
  }
  if (
    Object.keys(evidence.rollback).sort().join('|') !==
      ['code', 'database', 'provider'].join('|') ||
    Object.values(evidence.rollback).some((value) => !value)
  ) {
    errors.push('evidence:rollback')
  }

  const execution = read(EXECUTION_PATH)
  for (const token of [
    IMPLEMENTATION_PARENT,
    REMEDIATION_CANDIDATE,
    'Remediation round: 2 of 2',
    'STALE_UNREVALIDATED',
    'CF-P1-AUDIT-FRESH-01',
    'DESIGN_REQUIRED',
    'All readiness states remain `FAIL`',
    'no data or external-system',
  ]) {
    if (!execution.includes(token)) errors.push('execution:token')
  }
}

export type B5A2ASourceSnapshot = Readonly<{
  action: string
  agencySettingsPage: string
  allSubaccountsPage: string
  createSubaccountButton: string
  detailsConsumerPaths: readonly string[]
  entrySources: readonly string[]
  menuOptions: string
  projectionService: string
  serverAdapter: string
  sidebarIndex: string
  sourceText: string
  subaccountSettingsPage: string
  types: string
}>

const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0

export const verifyB5A2ASourceSnapshot = (
  snapshot: B5A2ASourceSnapshot
): string[] => {
  const errors: string[] = []
  const boundedSources = [
    snapshot.action,
    snapshot.agencySettingsPage,
    snapshot.allSubaccountsPage,
    snapshot.createSubaccountButton,
    snapshot.menuOptions,
    snapshot.projectionService,
    snapshot.serverAdapter,
    snapshot.sidebarIndex,
    snapshot.subaccountSettingsPage,
  ].join('\n')
  const nonAdapterSources = [
    snapshot.action,
    snapshot.agencySettingsPage,
    snapshot.allSubaccountsPage,
    snapshot.createSubaccountButton,
    snapshot.menuOptions,
    snapshot.projectionService,
    snapshot.sidebarIndex,
    snapshot.subaccountSettingsPage,
  ].join('\n')

  if (/from ['"]@\/lib\/db['"]/.test(snapshot.agencySettingsPage)) {
    errors.push('page-db:agency-settings')
  }
  if (/from ['"]@\/lib\/db['"]/.test(snapshot.subaccountSettingsPage)) {
    errors.push('page-db:subaccount-settings')
  }
  if (/from ['"]\.\/db['"]/.test(snapshot.types)) errors.push('types:db')
  if (/\bgetAuthUserDetails\b/.test(snapshot.sourceText)) {
    errors.push('retired:getAuth')
  }
  if (/\bgetSubAccountTeamMembers\b/.test(snapshot.sourceText)) {
    errors.push('retired:getTeamMembers')
  }
  if (
    /import\s*\{[^}]*\b(?:Agency|SubAccount|User|Permissions)\b[^}]*\}\s*from\s*['"]@prisma\/client['"]/.test(
      nonAdapterSources
    )
  ) {
    errors.push('projection:broad-prisma-import')
  }
  if (/\bany\b/.test(boundedSources)) errors.push('projection:any')
  if (
    /\bas\s+(?:Agency|SubAccount|User|Permissions|string|unknown)\b/.test(
      boundedSources
    )
  ) {
    errors.push('projection:cast')
  }
  if (/agencyDetails=\{\{\s*\.\.\./.test(boundedSources)) {
    errors.push('projection:agency-spread')
  }
  if (
    /\bRecord\s*<\s*string\s*,|\[\s*key\s*:\s*string\s*\]|JSON\.(?:parse|stringify)/.test(
      boundedSources
    )
  ) {
    errors.push('projection:wrapper')
  }

  const expectedConsumers = [
    'src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx',
    'src/app/(main)/subaccount/[subaccountId]/settings/page.tsx',
    'src/components/sidebar/menu-options.tsx',
  ]
  if (
    snapshot.detailsConsumerPaths.slice().sort().join('|') !==
    expectedConsumers.slice().sort().join('|')
  ) {
    errors.push('details:consumers')
  }

  if (
    /legacyActivityActorName|listLegacyActorNames|getLegacyActorName|includeLegacyName|\buserName\b/.test(
      boundedSources
    )
  ) errors.push('compatibility:retired-name-chain')

  const entryCalls = snapshot.entrySources.reduce(
    (total, source) => total + count(source, /verifyAndAcceptInvitation\s*\(/g),
    0
  )
  if (entryCalls !== 4) errors.push('entry-call:count')
  if (count(snapshot.action, /^export const /gm) !== 1) {
    errors.push('client-action:count')
  }

  if (/\btake:\s*250\b/.test(snapshot.serverAdapter)) {
    errors.push('adapter:silent-list-cap')
  }
  if (count(snapshot.serverAdapter, /\btake:\s*251\b/g) !== 8) {
    errors.push('adapter:overflow-sentinels')
  }
  if (
    !/db\.subAccount\.findMany\([\s\S]*\n\s+Permissions:\s*\{/.test(
      snapshot.serverAdapter
    )
  ) {
    errors.push('adapter:assignee-root')
  }
  if (!/listAgencySubaccountSelectors/.test(snapshot.serverAdapter)) {
    errors.push('adapter:settings-selectors')
  }

  return errors.sort()
}

const verifyAgencyPurposeType = () => {
  const sourceFile = parse('src/components/forms/agency-details.tsx')
  const props = sourceFile.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Props'
  )
  if (!props || !ts.isTypeLiteralNode(props.type)) return false
  const data = props.type.members.find(
    (member): member is ts.PropertySignature =>
      ts.isPropertySignature(member) && member.name.getText(sourceFile) === 'data'
  )
  if (!data?.questionToken || !data.type || !ts.isTypeReferenceNode(data.type)) {
    return false
  }
  if (data.type.typeName.getText(sourceFile) !== 'Readonly') return false
  const purpose = data.type.typeArguments?.[0]
  if (!purpose || !ts.isTypeLiteralNode(purpose)) return false
  const fields = purpose.members
    .filter(ts.isPropertySignature)
    .map((member) => member.name.getText(sourceFile))
    .sort()
  return fields.join('|') === exactAgencyPurposeFields.join('|')
}

export const verifyB5A2ARepository = () => {
  const errors: string[] = []

  const diff = Bun.spawnSync(
    ['git', 'diff', '--name-only', IMPLEMENTATION_PARENT, '--'],
    { cwd: repositoryRoot }
  )
  if (diff.exitCode !== 0) errors.push('diff:read')
  const changedPaths = normalize(diff.stdout.toString())
    .split('\n')
    .filter(Boolean)
  for (const path of changedPaths) {
    if (!allowedPaths.has(path)) errors.push(`allowlist:${path}`)
  }

  const requiredNewPaths = [
    EVIDENCE_PATH,
    EXECUTION_PATH,
    'src/features/agency-projections/actions.ts',
    'src/features/agency-projections/projection-service.ts',
    'src/features/agency-projections/server-projection-service.ts',
  ]
  for (const path of requiredNewPaths) {
    try {
      read(path)
    } catch {
      errors.push(`missing:${path}`)
    }
  }
  verifyCandidateEvidence(errors)

  const queries = read('src/lib/queries.ts')
  const types = read('src/lib/types.ts')
  const sourceRootFiles = Bun.spawnSync(['git', 'ls-files', 'src'], {
    cwd: repositoryRoot,
  }).stdout.toString().split(/\r?\n/).filter(Boolean)
  const sourceText = sourceRootFiles
    .map((path) => read(path))
    .join('\n')
  if (/\bgetAuthUserDetails\b/.test(sourceText)) errors.push('retired:getAuth')
  if (/\bgetSubAccountTeamMembers\b/.test(sourceText)) {
    errors.push('retired:getTeamMembers')
  }
  const detailsConsumers = sourceRootFiles.filter((path) =>
    /<SubAccountDetails\b/.test(read(path))
  )
  const expectedConsumers = [
    'src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx',
    'src/app/(main)/subaccount/[subaccountId]/settings/page.tsx',
    'src/components/sidebar/menu-options.tsx',
  ]
  if (
    detailsConsumers.sort().join('|') !== expectedConsumers.sort().join('|')
  ) errors.push('details:consumers')
  for (const path of expectedConsumers) {
    if (/\buserId\s*=/.test(read(path))) errors.push(`details:userId:${path}`)
  }
  if (/\buserId\b/.test(read('src/components/forms/subaccount-details.tsx'))) {
    errors.push('details:userId:component')
  }

  const entryPaths = [
    'src/app/(main)/agency/page.tsx',
    'src/app/(main)/subaccount/page.tsx',
    'src/app/(main)/agency/[agencyId]/layout.tsx',
    'src/app/(main)/subaccount/[subaccountId]/layout.tsx',
  ]
  errors.push(
    ...verifyB5A2ASourceSnapshot({
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
      detailsConsumerPaths: detailsConsumers,
      entrySources: entryPaths.map(read),
      menuOptions: read('src/components/sidebar/menu-options.tsx'),
      projectionService: read(
        'src/features/agency-projections/projection-service.ts'
      ),
      serverAdapter: read(
        'src/features/agency-projections/server-projection-service.ts'
      ),
      sidebarIndex: read('src/components/sidebar/index.tsx'),
      sourceText,
      subaccountSettingsPage: read(
        'src/app/(main)/subaccount/[subaccountId]/settings/page.tsx'
      ),
      types,
    })
  )

  assertDigest(
    errors,
    'remainder:queries',
    digest(normalizeB5A2AQueries(queries)),
    '18db1594db66ee1fd85155df581ffb06108c492c16747631d4dab6dda4390d70'
  )
  assertDigest(
    errors,
    'remainder:types',
    digest(normalizeB5A2ATypes(types)),
    'e9a054240ea007d564bd9ff0e33f750822102b0a4586b6d3834795e8e7fb21b2'
  )
  assertDigest(
    errors,
    'remainder:agency-details',
    digest(
      normalizeB5A2AAgencyDetails(
        read('src/components/forms/agency-details.tsx')
      )
    ),
    '385d17bbbfb07034b3fbd14dbfb5a82a1cd877cccd035203012cb82987818143'
  )
  if (!verifyAgencyPurposeType()) errors.push('agency-details:type')

  if (/\bgetNotificationAndUser\b/.test(queries)) {
    errors.push('node:getNotificationAndUser:retired')
  }
  if (/\bsaveActivityLogsNotification\b/.test(queries)) {
    errors.push('node:saveActivityLogsNotification:retired')
  }

  const subaccountForm = parse('src/components/forms/subaccount-details.tsx')
  const queryImports = subaccountForm.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === '@/lib/queries'
  )
  if (queryImports.length !== 1) errors.push('node:subaccount-import:count')
  else {
    assertDigest(
      errors,
      'node:subaccount-import',
      nodeDigest(queryImports[0], subaccountForm),
      'edd4a616c6058d12c0e913cc505dac4d0c219cb2a65304436cf37e8f1aa1b5f8'
    )
  }
  assertDigest(
    errors,
    'node:subaccount-submit',
    nodeDigest(namedFunctionDeclaration(subaccountForm, 'onSubmit'), subaccountForm),
    '539742712f3d3c36af29497eb251d02ff1a1cdd1ca05d141af1dc2da65772382'
  )

  const agencyForm = parse('src/components/forms/agency-details.tsx')
  const ticketForm = parse('src/components/forms/ticket-form.tsx')
  assertDigest(
    errors,
    'node:ticket-submit',
    nodeDigest(namedVariableStatement(ticketForm, 'onSubmit'), ticketForm),
    'aa12b9cce88b0f4371c2b7979c6f8473caa721ac209e1464b55946e0abd32d8b'
  )

  const agencyNodeHashes: ReadonlyArray<readonly [string, ts.Node, string]> = [
    ['handleSubmit', namedVariableStatement(agencyForm, 'handleSubmit'), 'd1d2b24c34c785d578963f849d3f18b9a3b604ad2bc50469a6cf4ca1917059f0'],
    ['handleDeleteAgency', namedVariableStatement(agencyForm, 'handleDeleteAgency'), '3a24b21d6de9fff1bb00c469f1eafcfe7e6df9239f2fb0402a8d3afa83995fe1'],
  ]
  for (const [name, node, expected] of agencyNodeHashes) {
    assertDigest(errors, `node:agency-${name}`, nodeDigest(node, agencyForm), expected)
  }
  const agencyCalls: ReadonlyArray<readonly [string, string, string]> = [
    ['provision', 'provisionAgencyOwner', '4f9d92776f9917c78448551c93fcb573a085df8b58e7019a76f6c21253f26f40'],
    ['upsert', 'upsertAgency', '2b88b82e273f55edec0fa47e7c8a41d06fbd6bbf99fd721ec48dfa20d3b68e5a'],
    ['fetch', 'fetch', 'a66562ba4bb9e88cc67bb819554a6f4f620daec14ff343405dc370dc82cce882'],
    ['delete', 'deleteAgency', 'fe642117eb8bf1d4b603994ad1009be4f1f52acb81cb014822a9359d662bbe73'],
    ['goal', 'updateAgencyGoal', '5d603ec92586286702feb900ffcc2e0f12e824cb2d4d7e75b43da19251fdfd8b'],
  ]
  for (const [name, expression, expected] of agencyCalls) {
    const calls = callExpressions(agencyForm, expression)
    if (calls.length !== 1) errors.push(`node:agency-${name}:count`)
    else assertDigest(errors, `node:agency-${name}`, nodeDigest(calls[0], agencyForm), expected)
  }
  const goalAttributes = descendants(agencyForm).filter(
    (node): node is ts.JsxAttribute =>
      ts.isJsxAttribute(node) &&
      node.name.getText(agencyForm) === 'onValueChange'
  )
  if (goalAttributes.length !== 1) errors.push('node:agency-goal-attribute:count')
  else {
    assertDigest(
      errors,
      'node:agency-goal-attribute',
      nodeDigest(goalAttributes[0], agencyForm),
      '534de09aefdfe1ef26108d7b20ddb34819d20d094bb8630e5b838585132be5bf'
    )
  }

  assertDigest(
    errors,
    'file:account-actions',
    digest(read('src/features/accounts/actions.ts')),
    'e3804c4486b39ae11af2416e3bf7c125d5ad1e702fbd6715b16084ecadda598d'
  )
  const entryCalls = entryPaths.flatMap((path) => {
    const sourceFile = parse(path)
    return callExpressions(sourceFile, 'verifyAndAcceptInvitation').map((node) => ({
      node,
      sourceFile,
    }))
  })
  if (entryCalls.length !== 4) errors.push('entry-call:count')
  for (const call of entryCalls) {
    assertDigest(
      errors,
      'entry-call',
      nodeDigest(call.node, call.sourceFile),
      'da8dffbc20a8b2d7ec3c0d436fb50ab77b03b39d30eeaa528d2920f8d3647f0a'
    )
  }

  const serverAdapter = read(
    'src/features/agency-projections/server-projection-service.ts'
  )
  if (/\binclude\s*:/.test(serverAdapter)) errors.push('adapter:include')
  if (/select\s*:\s*true\s*[,}]/.test(serverAdapter)) {
    errors.push('adapter:relation-select')
  }
  if (/\b(console\.|process\.env|fetch\s*\()/.test(
    read('src/features/agency-projections/projection-service.ts') +
      serverAdapter +
      read('src/features/agency-projections/actions.ts')
  )) errors.push('projection:side-effect')

  return errors.sort()
}

if (import.meta.main) {
  if (process.argv.length !== 2) {
    console.error('B5A2A_FAIL argument-count')
    process.exit(1)
  }

  try {
    const errors = verifyB5A2ARepository()
    if (errors.length > 0) {
      console.error(`B5A2A_FAIL errors=${errors.length} first=${errors[0]}`)
      process.exit(1)
    }
    const ledgerCount = readCandidateEvidence().closureLedger.length
    console.log(
      `B5A2A_PASS records=${ledgerCount} projections=7 client_actions=1 consumers=3 compatibility_sinks=0 entry_calls=4`
    )
  } catch {
    console.error('B5A2A_FAIL verifier-error')
    process.exit(1)
  }
}
