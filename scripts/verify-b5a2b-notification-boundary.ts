import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { verifyRepository } from './agency-authority-inventory-lib'

const ACCEPTED_PARENT = '7f236cbba1281c0bdaccbfa6770fcc0c128a4f80'
const IMPLEMENTATION_GATE = '1b3b36256629d3aaae567ffb66a351ece036359e'
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })

export const b5a2bWriterPaths = [
  'src/app/(main)/agency/[agencyId]/all-subaccounts/_components/delete-button.tsx',
  'src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/_components/funnel-products-table.tsx',
  'src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/_components/funnel-editor-navigation.tsx',
  'src/app/(main)/subaccount/[subaccountId]/pipelines/_components/pipeline-lane.tsx',
  'src/app/(main)/subaccount/[subaccountId]/pipelines/_components/pipeline-ticket.tsx',
  'src/components/forms/agency-details.tsx',
  'src/components/forms/contact-user-form.tsx',
  'src/components/forms/create-pipeline-form.tsx',
  'src/components/forms/funnel-form.tsx',
  'src/components/forms/funnel-page.tsx',
  'src/components/forms/lane-form.tsx',
  'src/components/forms/subaccount-details.tsx',
  'src/components/forms/ticket-form.tsx',
  'src/components/forms/upload-media.tsx',
  'src/components/global/tag-creator.tsx',
  'src/components/media/media-card.tsx',
] as const
const writerPaths = b5a2bWriterPaths

const compatibilityPaths = [
  'src/features/agency-projections/projection-service.ts',
  'src/features/agency-projections/server-projection-service.ts',
  'src/components/sidebar/index.tsx',
  'src/components/sidebar/menu-options.tsx',
  'src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx',
  'src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx',
  'src/components/forms/subaccount-details.tsx',
  'src/app/(main)/subaccount/[subaccountId]/settings/page.tsx',
] as const

export const b5a2bLegacyControlNodeHashes = [
  '8880e1739333046513c7b48ad099bf95505c295717cf52f17147248212fbac0b',
  'a6648029bf425722674a234b71219abc46e5b5b732ff415f56f77c8ab81a4327',
  'da18ceba4cbabc973e0c82a52334a466cdaacb45d927cbdedb310d1ecfbb98de',
  'd1624507371a52ba6fb5ac63e381ffadce58a6ee01213491523a3b31efac85b0',
  'b2e2cc619ca660bf7d3ff57cd6e6d3a7d3398a3d60f77df08c49c0dc01564654',
  'd8dd8e46ffb555e874d73ca923a74de3355a3a5170271783ada2bdab5da1c27e',
] as const

const protectedCandidateHashes: Readonly<Record<string, string>> = {
  'src/lib/queries.ts':
    'c0fff921c03f3d40c3675d7ff85603e082be512b087e8f87572365e3d8cef892',
  'src/lib/types.ts':
    '9a1b8c7703279a3eef54b4f252fe3dace791a62ff795c5367e4973a4cf13c832',
  'src/app/(main)/agency/[agencyId]/layout.tsx':
    '23b6ef375851f9af2d3aea7b54dd12268d06c115bc5a0ebcf5fad9f17172e50a',
  'src/app/(main)/subaccount/[subaccountId]/layout.tsx':
    'ca97fd57f80dc80002aceee6ff3c6b05cf220ee2c4349a50231221a6bf78d217',
  'src/components/global/infobar.tsx':
    'a30c95df2be708c6f630264da4894189efcfc39c51d8583054c28ece1acbff69',
  'src/app/(main)/agency/[agencyId]/all-subaccounts/_components/delete-button.tsx':
    '287ecf4a3820075c647420a46d3cf2e974ceaf41605556947bd7ca95b965900f',
  'src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/_components/funnel-products-table.tsx':
    '01566330408c92a0e3397e82100a209737ebd996d7934ef5a7bd5aad1f5e813f',
  'src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/_components/funnel-editor-navigation.tsx':
    '004cae8fdbb1fbdecca6e912536cbd994517761501d214d4b36847a592a8471d',
  'src/app/(main)/subaccount/[subaccountId]/pipelines/_components/pipeline-lane.tsx':
    'e3d625d9a72dd42aed4631273d89eb2f81b6fc13d3a54d2d4443c7982bbd4189',
  'src/app/(main)/subaccount/[subaccountId]/pipelines/_components/pipeline-ticket.tsx':
    '470a495bfec7771ebe8bd863143374bf04dfdd2a9e702f21f939866da3b4bf6e',
  'src/components/forms/agency-details.tsx':
    '6ea1e7f8ac0ad20bb3b510265d09686184eda3df2a07ba56b3471fc7734e96bc',
  'src/components/forms/contact-user-form.tsx':
    'f5ee963f2a4dc3e664fb92081d639ec8b31bee822634bda6e374d86d8eaf8d24',
  'src/components/forms/create-pipeline-form.tsx':
    '60637a85933c8ba67ee6bcfd0ac67de861ad7fe96e0ee63b376089e7fddb65bc',
  'src/components/forms/funnel-form.tsx':
    'f3df5c171f4729765bb038911dc45d53ef3fed8f5a5c00d7135e56ee2d91fec6',
  'src/components/forms/funnel-page.tsx':
    'c3909be276ca26d54d8c8a30b28d9abc6bad98cec375fd618b54f5ed2f66db78',
  'src/components/forms/lane-form.tsx':
    '0fdcae02315ab07b309b1ec1a4f49453229b1c74f59840e97f133e180ef30532',
  'src/components/forms/subaccount-details.tsx':
    'b086e422c8d77bd771b7c4dcf2cb7b48e58134600a0d022c55a51a59610a05c2',
  'src/components/forms/ticket-form.tsx':
    '84cfe06b06429b98a7a7b59948bcf62b201a0200c4b84b4041ab304e5236b392',
  'src/components/forms/upload-media.tsx':
    '3e5683d790732f10c1a977b486bffb5ad51583a36b4feccd5d7b49cb272b6c25',
  'src/components/global/tag-creator.tsx':
    '53cd3a400ffd00894585d7132c7cee5eedccb17b98a36c561d63616043701477',
  'src/components/media/media-card.tsx':
    '282a4053c0d1734797c78532e2f3e095334e7b1fdb2cc056f80fb0f743664e36',
  'src/features/agency-projections/projection-service.ts':
    '8bb561e55e2ee4fe40d9ee03dd7746e6ed08f6e605f254fa3a6fc0721ebdee8d',
  'src/features/agency-projections/server-projection-service.ts':
    '803fa43c58e1eb4553e5cfc5833f226a8d57c3d15a6e836d286604c0ed43b186',
  'src/components/sidebar/index.tsx':
    '480be30821f559b8b8defcb6a626f59d2ecc66d5d9f6f5a63337db8c6f67c592',
  'src/components/sidebar/menu-options.tsx':
    'a9072c06c4990c254c92e8fa46d740e971bd58db8b858964087c21ed656461cd',
  'src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx':
    '333bdf8f9cf8d4310c8cfba24413baaef38fdd9a6341b6178bfa3817b72950c9',
  'src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx':
    '7d0f8dac1d1016383d469b8883e9fdcff3a80bcc087d14b8a5466728dc61ebde',
  'src/app/(main)/subaccount/[subaccountId]/settings/page.tsx':
    '20798cfdd20a3cce592dcbe1a8519f68c058aedebaccc5a5ed05509e6c24820f',
}

const allowedPaths = new Set([
  'docs/evidence/CF-P1-B5A2B-candidate-verification.json',
  'docs/execution/CF-P1-B5A2B-notification-activity-boundary.md',
  'docs/issues/CF-P1-B5A2B-notification-activity-boundary.md',
  'docs/security/agency-authority/inventory.json',
  'docs/security/agency-authority/inventory.lock.json',
  'scripts/agency-authority-inventory-lib.ts',
  'scripts/verify-b5a2a-projections.ts',
  'scripts/verify-b5a2b-notification-boundary.ts',
  'src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx',
  ...writerPaths,
  'src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx',
  'src/app/(main)/agency/[agencyId]/layout.tsx',
  'src/app/(main)/subaccount/[subaccountId]/layout.tsx',
  'src/app/(main)/subaccount/[subaccountId]/settings/page.tsx',
  'src/components/global/infobar.tsx',
  'src/components/sidebar/index.tsx',
  'src/components/sidebar/menu-options.tsx',
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
const read = (path: string) =>
  readFileSync(join(repositoryRoot, path), 'utf8')
const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0
const lineCount = (text: string, marker: string) =>
  normalize(text).split('\n').filter((line) => line.includes(marker)).length

const readParent = (path: string) => {
  const result = Bun.spawnSync(['git', 'show', `${ACCEPTED_PARENT}:${path}`], {
    cwd: repositoryRoot,
  })
  if (result.exitCode !== 0) throw new Error('parent-read')
  return result.stdout.toString()
}

const parse = (path: string, text: string) =>
  ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )

const descendants = (sourceFile: ts.SourceFile) => {
  const nodes: ts.Node[] = []
  const visit = (node: ts.Node) => {
    nodes.push(node)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return nodes
}

const namedNodeHash = (path: string, text: string, name: string) => {
  const sourceFile = parse(path, text)
  const matches = descendants(sourceFile).filter(
    (node) =>
      (ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (declaration) =>
            ts.isIdentifier(declaration.name) && declaration.name.text === name
        )) ||
      (ts.isFunctionDeclaration(node) && node.name?.text === name) ||
      (ts.isTypeAliasDeclaration(node) && node.name.text === name)
  )
  return matches.length === 1 ? digest(matches[0].getText(sourceFile)) : null
}

const runtimeExportNames = (path: string, text: string) => {
  const sourceFile = parse(path, text)
  const names: string[] = []
  for (const statement of sourceFile.statements) {
    const exported =
      ts.canHaveModifiers(statement) &&
      ts
        .getModifiers(statement)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    if (!exported) continue
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      names.push(statement.name.text)
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text)
      }
    }
  }
  return names.sort()
}

const walk = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name)
    return entry.isDirectory() ? walk(absolute) : [absolute]
  })

const sourcePaths = () =>
  walk(join(repositoryRoot, 'src'))
    .filter((path) => /\.tsx?$/.test(path))
    .map((path) => relative(repositoryRoot, path).replaceAll('\\', '/'))
    .sort()

const isLegacyWriterCall = (node: ts.Expression) => {
  let expression = node
  while (
    ts.isAwaitExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  ) {
    expression = expression.expression
  }
  return (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'saveActivityLogsNotification'
  )
}

export const normalizeWriterRemainder = (path: string, text: string) => {
  const sourceFile = parse(path, text)
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === '@/lib/queries' &&
        node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings)
      ) {
        const bindings = node.importClause.namedBindings.elements.filter(
          (element) => element.name.text !== 'saveActivityLogsNotification'
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
      if (ts.isExpressionStatement(node) && isLegacyWriterCall(node.expression)) {
        return undefined
      }
      return ts.visitEachChild(node, visit, context)
    }
    return (node) => {
      const result = ts.visitNode(node, visit)
      if (!result || !ts.isSourceFile(result)) throw new Error('transform')
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

const writerCallCounts: Readonly<Record<string, number>> = {
  'src/app/(main)/agency/[agencyId]/all-subaccounts/_components/delete-button.tsx': 1,
  'src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/_components/funnel-products-table.tsx': 1,
  'src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/_components/funnel-editor-navigation.tsx': 1,
  'src/app/(main)/subaccount/[subaccountId]/pipelines/_components/pipeline-lane.tsx': 1,
  'src/app/(main)/subaccount/[subaccountId]/pipelines/_components/pipeline-ticket.tsx': 1,
  'src/components/forms/agency-details.tsx': 1,
  'src/components/forms/contact-user-form.tsx': 1,
  'src/components/forms/create-pipeline-form.tsx': 1,
  'src/components/forms/funnel-form.tsx': 1,
  'src/components/forms/funnel-page.tsx': 2,
  'src/components/forms/lane-form.tsx': 1,
  'src/components/forms/subaccount-details.tsx': 1,
  'src/components/forms/ticket-form.tsx': 1,
  'src/components/forms/upload-media.tsx': 1,
  'src/components/global/tag-creator.tsx': 2,
  'src/components/media/media-card.tsx': 1,
}

const legacyWriterCounts = (path: string, text: string) => {
  const sourceFile = parse(path, text)
  const nodes = descendants(sourceFile)
  const imports = nodes.filter(
    (node) =>
      ts.isImportSpecifier(node) &&
      node.name.text === 'saveActivityLogsNotification'
  ).length
  const calls = nodes.filter(
    (node) =>
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'saveActivityLogsNotification'
  ).length
  return { calls, imports }
}

export const verifyWriterRetirementSnapshot = (
  parent: Readonly<Record<string, string>>,
  candidate: Readonly<Record<string, string>>
) => {
  const errors: string[] = []
  for (const path of writerPaths) {
    const parentText = parent[path]
    const candidateText = candidate[path]
    if (typeof parentText !== 'string' || typeof candidateText !== 'string') {
      errors.push(`writer-missing:${path}`)
      continue
    }
    const parentCounts = legacyWriterCounts(path, parentText)
    const candidateCounts = legacyWriterCounts(path, candidateText)
    if (parentCounts.imports !== 1) errors.push(`writer-import:${path}`)
    if (parentCounts.calls !== writerCallCounts[path]) {
      errors.push(`writer-call:${path}`)
    }
    if (candidateCounts.imports !== 0 || candidateCounts.calls !== 0) {
      errors.push(`writer-candidate:${path}`)
    }
    if (
      path !== 'src/components/forms/subaccount-details.tsx' &&
      digest(normalizeWriterRemainder(path, parentText)) !==
        digest(normalizeWriterRemainder(path, candidateText))
    ) errors.push(`writer-remainder:${path}`)
  }
  return errors.sort()
}

export const verifyLegacyControlSnapshot = (
  parentProjection: string,
  candidateProjection: string
) => {
  const errors: string[] = []
  const sourceFile = parse('projection-service.ts', parentProjection)
  const hashes = new Set(
    descendants(sourceFile).map((node) => digest(node.getText(sourceFile)))
  )
  for (const expected of b5a2bLegacyControlNodeHashes) {
    if (!hashes.has(expected)) errors.push(`legacy-control:${expected}`)
  }
  if (
    /includeLegacyName|legacyName|legacyActivityActorName|getLegacyActorName|listLegacyActorNames/.test(
      candidateProjection
    )
  ) errors.push('legacy-control:candidate')
  return errors.sort()
}

export const verifyProtectedCandidateSnapshot = (
  snapshot: Readonly<Record<string, string>>
) =>
  Object.entries(snapshot)
    .flatMap(([path, text]) => {
      const expected = protectedCandidateHashes[path]
      if (!expected) return [`protected-unknown:${path}`]
      return digest(text) === expected ? [] : [`protected:${path}`]
    })
    .sort()

export type B5A2BSourceSnapshot = Readonly<{
  activityFoundation: string
  agencyLayout: string
  infoBar: string
  notificationView: string
  serverView: string
  sourceText: string
  subaccountLayout: string
}>

export const verifyB5A2BSourceSnapshot = (
  snapshot: B5A2BSourceSnapshot
): string[] => {
  const errors: string[] = []
  const owned = [
    snapshot.activityFoundation,
    snapshot.notificationView,
    snapshot.serverView,
  ].join('\n')
  if (
    /getNotificationAndUser|saveActivityLogsNotification|legacyActivityActorName|listLegacyActorNames|getLegacyActorName|includeLegacyName|\buserName\b/.test(
      snapshot.sourceText
    )
  ) errors.push('retired-surface')
  if (
    /from ['"][^'"]*activity-foundation-service['"]/.test(
      snapshot.sourceText
    ) ||
    /db\.notification\.(?:create|createMany|update|updateMany|upsert)\s*\(/.test(
      snapshot.sourceText
    )
  ) errors.push('activity-reachability')
  if (/\bany\b|\bas\s+(?:unknown|string|Role)\b/.test(owned)) {
    errors.push('owned-broad-type')
  }
  if (/console\.|process\.env|\bfetch\s*\(/.test(owned)) {
    errors.push('owned-side-effect')
  }
  if (/requestedAction|rawAction|input\.action/.test(snapshot.serverView)) {
    errors.push('caller-action')
  }
  const policyHashes: Readonly<Record<string, string>> = {
    agencyRoles:
      'fa51863adb1ffad5c58abd59e50f0340dfd15596e2977ac4f69b77ebbd2c67da',
    assertNotificationViewAction:
      '720cd08d27567142bd82896ad867e63f021371701d7d4f229fb529f5c0ed1b36',
    isAction:
      'd151b515e4fc56a4d585d7ff2172f44632620e1a916aa453cd16e6c980b4f89f',
    isRole:
      '462c7e308e7ecbeaa59a7cf74182eecfdeec20886b2f516d9d407c323ae260a2',
    NotificationViewAction:
      'cda7561b3c1e2cb096f8ae9df1dbfb24a30b3c70d2490977cb3f92ae83959df9',
  }
  for (const [name, expected] of Object.entries(policyHashes)) {
    if (
      namedNodeHash('notification-view-service.ts', snapshot.notificationView, name) !==
      expected
    ) errors.push(`policy-node:${name}`)
  }
  if (
    namedNodeHash(
      'server-notification-view-service.ts',
      snapshot.serverView,
      'notificationViewService'
    ) !== 'f8e99481ae9ee4d1de7831e2e2dfedeccfe387d470c7f68dbd487018537f4a37'
  ) errors.push('server-policy-node')
  if (/dangerouslySetInnerHTML|DOMParser|parseFromString/.test(snapshot.infoBar)) {
    errors.push('infobar-html')
  }
  if (
    runtimeExportNames(
      'notification-view-service.ts',
      snapshot.notificationView
    ).join('|') !==
    'assertNotificationViewAction|createNotificationViewService'
  ) errors.push('view-exports')
  if (
    runtimeExportNames('server-notification-view-service.ts', snapshot.serverView)
      .join('|') !== 'notificationViewService'
  ) errors.push('server-exports')
  if (
    runtimeExportNames('activity-foundation-service.ts', snapshot.activityFoundation)
      .join('|') !== 'createActivityFoundationService'
  ) errors.push('activity-exports')
  if (!snapshot.serverView.startsWith("import 'server-only'")) {
    errors.push('server-only')
  }
  if (count(snapshot.serverView, /db\.notification\.findMany\s*\(/g) !== 2) {
    errors.push('reader-query-count')
  }
  if (count(snapshot.serverView, /\btake:\s*101\b/g) !== 2) {
    errors.push('reader-bound')
  }
  if (
    count(
      snapshot.serverView,
      /orderBy:\s*\[\{ createdAt: 'desc' \}, \{ id: 'desc' \}\]/g
    ) !== 2
  ) errors.push('reader-order')
  for (const marker of [
    "const action = 'notification:view-agency'",
    "const subaccountAction = 'notification:view-subaccount'",
    "const agencyAction = 'notification:view-agency'",
    'assertAgencyOperator(context)',
    'assertNotificationViewAction(context.actor.role, action)',
    'assertNotificationViewAction(context.actor.role, subaccountAction)',
    'assertNotificationViewAction(context.actor.role, agencyAction)',
    'User: { agencyId }',
    'subAccountId: subaccountId',
    'SubAccount: {',
  ]) {
    if (!snapshot.serverView.includes(marker)) errors.push('reader-policy')
  }
  for (const marker of [
    "| 'notification:view-agency'",
    "| 'notification:view-subaccount'",
    'Role.AGENCY_OWNER',
    'Role.AGENCY_ADMIN',
    'Role.SUBACCOUNT_USER',
    'Role.SUBACCOUNT_GUEST',
    'Array.from(value).length <= maximum',
    'isBoundedText(record.message, 1024)',
    'isBoundedText(actor.name, 256)',
    'isBoundedText(actor.avatarUrl, 2048)',
    'records.length > maximumItems',
    'record.createdAt.toISOString()',
    'previous.id.localeCompare(current.id)',
  ]) {
    if (!snapshot.notificationView.includes(marker)) errors.push('view-contract')
  }
  if (count(snapshot.notificationView, /catch\s*\{[\s\S]*?new AccessError\('CONFLICT'\)/g) < 2) {
    errors.push('view-error-contract')
  }
  if (
    !snapshot.agencyLayout.includes(
      'notificationViewService\n    .getAgencyFeed(params.agencyId)'
    ) ||
    !snapshot.subaccountLayout.includes(
      'notificationViewService.getSubaccountFeed('
    )
  ) errors.push('reader-consumer')
  if (
    /from ['"]@\/lib\/db['"]|server-only|from ['"]next\/|from ['"](?:@clerk|stripe)|worker|scheduler|route\.ts/.test(
      snapshot.activityFoundation
    )
  ) errors.push('activity-runtime-import')
  if (
    /FOUNDATION_VALIDATION_ONLY|db\.notification|Notification\.(?:create|update|upsert)|['"](?:AGENCY|SUBACCOUNT)_[A-Z_]+['"]/.test(
      snapshot.activityFoundation
    )
  ) errors.push('activity-production-event')
  for (const marker of [
    "hasExactKeys(rawInput, ['context', 'event', 'label', 'receipt'])",
    "value.affectedRows !== 1",
    'value.stale',
    "result === 'CREATED'",
    "throw new AccessError('CONFLICT')",
    'Array.from(message).length > 1024',
  ]) {
    if (!snapshot.activityFoundation.includes(marker)) {
      errors.push('activity-contract')
    }
  }
  if (
    !snapshot.activityFoundation.includes(
      "result === 'CREATED' || result === 'DUPLICATE'"
    ) ||
    count(
      snapshot.activityFoundation,
      /catch\s*\{[\s\S]*?new AccessError\('CONFLICT'\)/g
    ) < 2
  ) errors.push('activity-finite-outcome')
  return Array.from(new Set(errors)).sort()
}

const verifyInventory = (errors: string[]) => {
  const result = verifyRepository(repositoryRoot)
  const expected = {
    records: 231,
    databaseImports: 22,
    directDatabaseCallers: 21,
    databaseAdapterInjections: 1,
    serverActionFiles: 5,
    serverActionExports: 50,
    queryExports: 36,
    apiRouteFiles: 5,
    apiHandlerSymbols: 6,
    pageFiles: 24,
    layoutFiles: 7,
    uploadRoutes: 4,
    uploadCallbacks: 4,
    providerBoundaries: 33,
  }
  if (result.errors.length > 0) errors.push('inventory-verification')
  for (const [key, value] of Object.entries(expected)) {
    if (result.counts[key as keyof typeof result.counts] !== value) {
      errors.push('inventory-count')
    }
  }
  const inventory = JSON.parse(
    read('docs/security/agency-authority/inventory.json')
  ) as Readonly<{ records: ReadonlyArray<Readonly<Record<string, unknown>>> }>
  const records = inventory.records.filter((record) =>
    typeof record.path === 'string' &&
    record.path.startsWith('src/features/notifications/')
  )
  if (records.length !== 5) errors.push('inventory-notification-records')
  const dormant = records.find(
    (record) => record.symbol === 'createActivityFoundationService'
  )
  if (
    !dormant ||
    dormant.action !== 'INTERNAL_ONLY' ||
    dormant.disposition !== 'DORMANT_BLOCKED' ||
    dormant.actorSource !== 'blocked'
  ) errors.push('inventory-dormant')
}

export const verifyB5A2BRepository = () => {
  const errors: string[] = []
  const source = sourcePaths().map(read).join('\n')
  errors.push(
    ...verifyB5A2BSourceSnapshot({
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
      sourceText: source,
      subaccountLayout: read(
        'src/app/(main)/subaccount/[subaccountId]/layout.tsx'
      ),
    })
  )
  for (const [path, expected] of Object.entries(protectedCandidateHashes)) {
    if (digest(read(path)) !== expected) errors.push(`protected:${path}`)
  }

  const parentWriters = writerPaths.map(readParent).join('\n')
  const currentWriters = writerPaths.map(read).join('\n')
  const parentWriterSnapshot = Object.fromEntries(
    writerPaths.map((path) => [path, readParent(path)])
  )
  const currentWriterSnapshot = Object.fromEntries(
    writerPaths.map((path) => [path, read(path)])
  )
  errors.push(
    ...verifyWriterRetirementSnapshot(
      parentWriterSnapshot,
      currentWriterSnapshot
    )
  )
  if (count(parentWriters, /\bsaveActivityLogsNotification\b/g) !== 34) {
    errors.push('writer-parent-symbol-count')
  }
  if (count(parentWriters, /saveActivityLogsNotification\s*\(/g) !== 18) {
    errors.push('writer-parent-call-count')
  }
  if (count(currentWriters, /\bsaveActivityLogsNotification\b/g) !== 0) {
    errors.push('writer-candidate-zero')
  }
  const parentImporters = writerPaths.filter((path) =>
    /import[\s\S]*?saveActivityLogsNotification[\s\S]*?from ['"]@\/lib\/queries['"]/.test(
      readParent(path)
    )
  )
  if (parentImporters.length !== 16) errors.push('writer-parent-importers')
  for (const path of writerPaths) {
    if (path === 'src/components/forms/subaccount-details.tsx') continue
    if (
      digest(normalizeWriterRemainder(path, readParent(path))) !==
      digest(normalizeWriterRemainder(path, read(path)))
    ) errors.push(`writer-remainder:${path}`)
  }

  const compatibilityText = compatibilityPaths.map(read).join('\n')
  if (
    /legacyActivityActorName|listLegacyActorNames|getLegacyActorName|includeLegacyName|\buserName\b/.test(
      compatibilityText
    )
  ) errors.push('compatibility-zero')
  const parentCompatibility = compatibilityPaths.map(readParent).join('\n')
  if (
    lineCount(parentCompatibility, 'legacyActivityActorName') !== 14 ||
    lineCount(parentCompatibility, 'listLegacyActorNames') !== 3 ||
    lineCount(parentCompatibility, 'getLegacyActorName') !== 4 ||
    normalize(parentCompatibility)
      .split('\n')
      .filter((line) => /\buserName\b/.test(line)).length !== 9
  ) errors.push('compatibility-parent-ledger')
  errors.push(
    ...verifyLegacyControlSnapshot(
      readParent('src/features/agency-projections/projection-service.ts'),
      read('src/features/agency-projections/projection-service.ts')
    )
  )

  const diff = Bun.spawnSync(
    ['git', 'diff', '--name-only', IMPLEMENTATION_GATE, '--'],
    { cwd: repositoryRoot }
  )
  if (diff.exitCode !== 0) errors.push('allowlist-read')
  for (const path of normalize(diff.stdout.toString()).split('\n').filter(Boolean)) {
    if (!allowedPaths.has(path)) errors.push(`allowlist:${path}`)
  }

  const status = Bun.spawnSync(['git', 'status', '--short'], {
    cwd: repositoryRoot,
  })
  if (status.exitCode !== 0) errors.push('status-read')
  const untracked = normalize(status.stdout.toString())
    .split('\n')
    .filter((line) => line.startsWith('?? '))
    .map((line) => line.slice(3).replace(/\/$/, ''))
  for (const path of untracked) {
    if (path === 'src/features/notifications' || path === 'tests/notifications') {
      continue
    }
    if (!allowedPaths.has(path)) errors.push(`allowlist-untracked:${path}`)
  }

  verifyInventory(errors)
  return Array.from(new Set(errors)).sort()
}

if (import.meta.main) {
  if (process.argv.length !== 2) {
    console.error('B5A2B_FAIL argument-count')
    process.exit(1)
  }
  try {
    const errors = verifyB5A2BRepository()
    if (errors.length > 0) {
      console.error(`B5A2B_FAIL errors=${errors.length} first=${errors[0]}`)
      process.exit(1)
    }
    console.log(
      'B5A2B_PASS records=2 readers=2 writer_imports=16 writer_calls=18 legacy_files=8 feed_limit=100 production_events=0'
    )
  } catch {
    console.error('B5A2B_FAIL verifier-error')
    process.exit(1)
  }
}
