import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const IMPLEMENTATION_PARENT = 'bbe5ec82a8184c21fc0d09f767891c5dc7f08534'
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })

const allowedPaths = new Set([
  'docs/evidence/CF-P1-B5A2A-candidate-verification.json',
  'docs/execution/CF-P1-B5A2A-actor-safe-projections.md',
  'docs/issues/CF-P1-B5A2A-actor-safe-projections.md',
  'docs/security/agency-authority/inventory.json',
  'docs/security/agency-authority/inventory.lock.json',
  'scripts/agency-authority-inventory-lib.ts',
  'scripts/verify-b5a2a-projections.ts',
  'src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx',
  'src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx',
  'src/app/(main)/agency/[agencyId]/settings/page.tsx',
  'src/app/(main)/agency/page.tsx',
  'src/app/(main)/subaccount/[subaccountId]/settings/page.tsx',
  'src/app/(main)/subaccount/page.tsx',
  'src/components/forms/agency-details.tsx',
  'src/components/forms/subaccount-details.tsx',
  'src/components/forms/ticket-form.tsx',
  'src/components/sidebar/index.tsx',
  'src/components/sidebar/menu-options.tsx',
  'src/features/agency-projections/actions.ts',
  'src/features/agency-projections/projection-service.ts',
  'src/features/agency-projections/server-projection-service.ts',
  'src/lib/queries.ts',
  'src/lib/types.ts',
  'tests/agency-projections/projection-service.test.ts',
  'tests/agency-projections/projection-surface.test.ts',
  'tests/authority-inventory/agency-authority-inventory.test.ts',
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

const normalizeQueries = (text: string) => {
  const sourceFile = parse('src/lib/queries.ts', text)
  return normalize(
    printer.printFile(
      removeNamedVariables(sourceFile, [
        'getAuthUserDetails',
        'getSubAccountTeamMembers',
      ])
    )
  )
}

const normalizeTypes = (text: string) => {
  const sourceFile = parse('src/lib/types.ts', text)
  const statements: ts.Statement[] = []
  for (const statement of sourceFile.statements) {
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

const normalizeAgencyDetails = (text: string) => {
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

const verify = () => {
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
  if (/from ['"]\.\/db['"]/.test(types)) errors.push('types:db')

  for (const path of [
    'src/app/(main)/agency/[agencyId]/settings/page.tsx',
    'src/app/(main)/subaccount/[subaccountId]/settings/page.tsx',
  ]) {
    if (/from ['"]@\/lib\/db['"]/.test(read(path))) errors.push(`page-db:${path}`)
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

  const compatibilityPaths = [
    'src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx',
    'src/components/sidebar/index.tsx',
  ]
  const compatibilityMappings = compatibilityPaths.reduce(
    (count, path) =>
      count +
      (read(path).match(/legacyActivityActorName=\{projection\.legacyActivityActorName\}/g)
        ?.length ?? 0),
    0
  )
  if (compatibilityMappings !== 2) errors.push('compatibility:mappings')

  assertDigest(
    errors,
    'remainder:queries',
    digest(normalizeQueries(queries)),
    'a8abbbcbb72826980143b1da92bb7562f3e0033af7b9333719f0cc9aed73fab7'
  )
  assertDigest(
    errors,
    'remainder:types',
    digest(normalizeTypes(types)),
    'cf5eaa285a4d8486056828203dc822e9a0d41eec017eed1dc73c1d3549449252'
  )
  assertDigest(
    errors,
    'remainder:agency-details',
    digest(normalizeAgencyDetails(read('src/components/forms/agency-details.tsx'))),
    '1679d010911a9fb351bbd27dc7df85776b77f0e2fb56ee3787f0350210363d0e'
  )
  if (!verifyAgencyPurposeType()) errors.push('agency-details:type')

  const querySource = parse('src/lib/queries.ts')
  assertDigest(
    errors,
    'node:getNotificationAndUser',
    nodeDigest(namedVariableStatement(querySource, 'getNotificationAndUser'), querySource),
    'cfe7c297af8f19b6c0f1a72f078acf28f13a90a009b498d8b0464b3b59931a83'
  )
  assertDigest(
    errors,
    'node:saveActivityLogsNotification',
    nodeDigest(
      namedVariableStatement(querySource, 'saveActivityLogsNotification'),
      querySource
    ),
    '5a5a1ccfbaa03dce8f4db75ed5a79a2cce43972be611f972e5bdba1e002c8f1c'
  )

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
      '4e104e2d1d4f7ede1400313531afd4f8a2befb70cd0db4860e89a7a9a827656f'
    )
  }
  assertDigest(
    errors,
    'node:subaccount-submit',
    nodeDigest(namedFunctionDeclaration(subaccountForm, 'onSubmit'), subaccountForm),
    '713140c5b26293b14b250533d726f46ef63ac7753571b169395b2b886a9b0fa8'
  )

  const agencyForm = parse('src/components/forms/agency-details.tsx')
  const ticketForm = parse('src/components/forms/ticket-form.tsx')
  const activityNodes = [
    ['subaccount', subaccountForm, '183d9c7ec7e2adad335117e89d1b75c4d788e6d9cdb86fb2429148997e65854f', '6950341cf109439e1a01adb3b22f57d82cc5759da6f9d91bbf677b5222ae6806'],
    ['agency', agencyForm, '87b4e688861a7b23c425d0cf64862691b7db49a05ff8ae211f76e1b4d4501d9f', '2d1499fb1f8a38292e42849f07ebe4a890bcccbfef0643e193054453ca76944f'],
    ['ticket', ticketForm, '840ab41e509d43bc8bd53e83d37028b01adcc0e2011934e378480d690484dfec', 'b3bd346667ff6f8f5016f81364641fd20b9bb43eea195b6039f67884cb2adca5'],
  ] as const
  for (const [name, sourceFile, callHash, descriptionHash] of activityNodes) {
    const calls = callExpressions(sourceFile, 'saveActivityLogsNotification')
    if (calls.length !== 1) {
      errors.push(`node:${name}-activity:count`)
      continue
    }
    assertDigest(errors, `node:${name}-activity`, nodeDigest(calls[0], sourceFile), callHash)
    const argument = calls[0].arguments[0]
    const description =
      argument && ts.isObjectLiteralExpression(argument)
        ? argument.properties.find(
            (property): property is ts.PropertyAssignment =>
              ts.isPropertyAssignment(property) &&
              property.name.getText(sourceFile) === 'description'
          )
        : undefined
    if (!description) errors.push(`node:${name}-description:count`)
    else {
      assertDigest(
        errors,
        `node:${name}-description`,
        nodeDigest(description, sourceFile),
        descriptionHash
      )
    }
  }

  assertDigest(
    errors,
    'node:ticket-submit',
    nodeDigest(namedVariableStatement(ticketForm, 'onSubmit'), ticketForm),
    '9adf0c9950dde28a613d8416b576a1b69780534474819d6bf83fd58ec9f27f46'
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
      '2b8880338472392bec4e6fc37d9749342b22923001a6d0db63c0ec17841093f2'
    )
  }

  assertDigest(
    errors,
    'file:account-actions',
    digest(read('src/features/accounts/actions.ts')),
    'e3804c4486b39ae11af2416e3bf7c125d5ad1e702fbd6715b16084ecadda598d'
  )
  const frozenLayouts: ReadonlyArray<readonly [string, string]> = [
    ['src/app/(main)/agency/[agencyId]/layout.tsx', '60e507efcdb0ffc6df440afdd31d81ab48aaea15a36ece960ca5100525d63525'],
    ['src/app/(main)/subaccount/[subaccountId]/layout.tsx', 'd12f84b0abbee14d4fd62013cc765941381287b810b7e2c5e8974b9cdd8db08d'],
  ]
  for (const [path, expected] of frozenLayouts) {
    assertDigest(errors, `file:${path}`, digest(read(path)), expected)
  }

  const entryPaths = [
    'src/app/(main)/agency/page.tsx',
    'src/app/(main)/subaccount/page.tsx',
    'src/app/(main)/agency/[agencyId]/layout.tsx',
    'src/app/(main)/subaccount/[subaccountId]/layout.tsx',
  ]
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

if (process.argv.length !== 2) {
  console.error('B5A2A_FAIL argument-count')
  process.exit(1)
}

try {
  const errors = verify()
  if (errors.length > 0) {
    console.error(`B5A2A_FAIL errors=${errors.length} first=${errors[0]}`)
    process.exit(1)
  }
  console.log(
    'B5A2A_PASS records=14 projections=7 client_actions=1 consumers=3 compatibility_sinks=2 entry_calls=4'
  )
} catch {
  console.error('B5A2A_FAIL verifier-error')
  process.exit(1)
}
