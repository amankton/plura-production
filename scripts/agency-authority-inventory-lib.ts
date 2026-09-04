import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import ts from 'typescript'

export const DOMAINS = [
  'identity/account',
  'agency',
  'subaccount',
  'team/permission/invitation',
  'billing/commerce/webhook',
  'contact',
  'notification/activity',
  'upload/media',
  'funnel/page/editor',
  'pipeline/lane/tag',
  'ticket/relations',
  'automation',
  'routing/public',
  'internal persistence',
] as const

export const INVOCATIONS = [
  'server action',
  'API handler',
  'page loader',
  'layout loader',
  'public loader',
  'upload router/callback',
  'provider callback',
  'internal-only',
] as const

export const EFFECTS = [
  'read',
  'create',
  'update',
  'delete',
  'reorder',
  'external call',
  'upload grant',
  'notification',
  'revalidation',
  'log',
  'composite',
  'no-op boundary',
] as const

export const DENIALS = [
  'unauthenticated',
  'unauthorized',
  'not found',
  'conflict/stale',
  'invalid input',
  'dormant blocked',
  'public unavailable',
  'internal invariant failure',
] as const

export const DISPOSITIONS = [
  'ACCEPTED_RETAIN',
  'B5A2',
  'B5A3',
  'B5A4',
  'B5A5',
  'B5A6',
  'B5A7',
  'B5A8',
  'DORMANT_BLOCKED',
  'PUBLIC_REVIEW_REQUIRED',
] as const

export const ACTIONS = [
  'account:entry',
  'account:provision',
  'agency:view',
  'agency:manage',
  'agency:delete',
  'subaccount:view',
  'subaccount:manage',
  'team:list',
  'team:read',
  'team:self-update',
  'team:manage',
  'team:invite',
  'contact:list',
  'contact:search',
  'contact:create',
  'contact:update',
  'commerce:catalog',
  'commerce:checkout',
  'commerce:configure',
  'commerce:metrics',
  'billing:manage',
  'webhook:receive',
  'webhook:process',
  'PUBLIC_BOUNDED',
  'INTERNAL_ONLY',
  'UNDEFINED_BLOCKED',
] as const

export const ACTOR_SOURCES = [
  'provider subject',
  'anonymous-public contract',
  'internal-derived actor',
  'blocked',
] as const

export type Domain = (typeof DOMAINS)[number]
export type Invocation = (typeof INVOCATIONS)[number]
export type Effect = (typeof EFFECTS)[number]
export type Denial = (typeof DENIALS)[number]
export type Disposition = (typeof DISPOSITIONS)[number]
export type Action = (typeof ACTIONS)[number]
export type ActorSource = (typeof ACTOR_SOURCES)[number]

export type DiscoveredSurface = {
  surfaceId: string
  path: string
  symbol: string
  invocation: Invocation
  parameterNames: string[]
  observedEffects: Effect[]
  sourceHash: string
}

export type InventoryRecord = {
  surfaceId: string
  domain: Domain
  path: string
  symbol: string
  invocation: Invocation
  effects: Effect[]
  actorSource: ActorSource
  requestedIds: string[]
  action: Action
  ownershipPath: string[]
  persistencePredicate: string
  denial: Denial
  concurrency: string
  publicBoundary: string
  disposition: Disposition
  sourceHash: string
}

export type InventoryDocument = {
  version: 1
  immutableParent: string
  records: InventoryRecord[]
}

export type InventoryLock = {
  version: 1
  immutableParent: string
  recordCount: number
  manifestHash: string
}

export const B5A1_IMMUTABLE_PARENT =
  'c6e989f8fb62bd99f28a2c537c57f4d85d069c72'

export type VerificationResult = {
  errors: string[]
  counts: {
    records: number
    databaseImports: number
    directDatabaseCallers: number
    databaseAdapterInjections: number
    serverActionFiles: number
    serverActionExports: number
    queryExports: number
    apiRouteFiles: number
    apiHandlerSymbols: number
    pageFiles: number
    layoutFiles: number
    uploadRoutes: number
    uploadCallbacks: number
    providerBoundaries: number
  }
  manifestHash: string
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])
const HTTP_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
])

const normalizePath = (value: string) => value.replaceAll('\\', '/')
const normalizeText = (value: string) => value.replaceAll('\r\n', '\n')

const canonicalHash = (value: string) =>
  `sha256:${createHash('sha256').update(normalizeText(value)).digest('hex')}`

const walkSource = (root: string, directory = join(root, 'src')): string[] => {
  const paths: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) {
      paths.push(...walkSource(root, absolute))
      continue
    }
    const extension = entry.name.endsWith('.tsx')
      ? '.tsx'
      : entry.name.endsWith('.ts')
        ? '.ts'
        : ''
    if (SOURCE_EXTENSIONS.has(extension)) paths.push(absolute)
  }
  return paths.sort((left, right) =>
    normalizePath(relative(root, left)).localeCompare(
      normalizePath(relative(root, right))
    )
  )
}

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) &&
  Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === kind))

const bindingNames = (name: ts.BindingName): string[] => {
  if (ts.isIdentifier(name)) return [name.text]
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : bindingNames(element.name)
  )
}

const parameterNames = (parameters: ts.NodeArray<ts.ParameterDeclaration>) =>
  parameters.flatMap((parameter) => bindingNames(parameter.name)).sort()

type RuntimeExport = {
  symbol: string
  parameters: string[]
  text: string
  callable: boolean
}

const runtimeExports = (
  sourceFile: ts.SourceFile,
  includeDefault = false
): RuntimeExport[] => {
  const exports: RuntimeExport[] = []
  for (const statement of sourceFile.statements) {
    if (includeDefault && ts.isExportAssignment(statement)) {
      let parameters: string[] = []
      let text = statement.getText(sourceFile)
      let callable = false
      if (ts.isIdentifier(statement.expression)) {
        for (const candidate of sourceFile.statements) {
          if (!ts.isVariableStatement(candidate)) continue
          const declaration = candidate.declarationList.declarations.find(
            (item) =>
              ts.isIdentifier(item.name) &&
              item.name.text === statement.expression.getText(sourceFile)
          )
          if (!declaration?.initializer) continue
          text = declaration.getText(sourceFile)
          if (
            ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer)
          ) {
            parameters = parameterNames(declaration.initializer.parameters)
            callable = true
          }
        }
      } else if (
        ts.isArrowFunction(statement.expression) ||
        ts.isFunctionExpression(statement.expression)
      ) {
        parameters = parameterNames(statement.expression.parameters)
        callable = true
      }
      exports.push({ symbol: 'default', parameters, text, callable })
      continue
    }
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue
    const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
    if (isDefault && !includeDefault) continue
    if (ts.isFunctionDeclaration(statement)) {
      const symbol = isDefault ? 'default' : statement.name?.text
      if (symbol) {
        exports.push({
          symbol,
          parameters: parameterNames(statement.parameters),
          text: statement.getText(sourceFile),
          callable: true,
        })
      }
      continue
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const names = bindingNames(declaration.name)
        const callable =
          Boolean(declaration.initializer) &&
          (ts.isArrowFunction(declaration.initializer!) ||
            ts.isFunctionExpression(declaration.initializer!) ||
            ts.isCallExpression(declaration.initializer!))
        const parameters =
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
            ? parameterNames(declaration.initializer.parameters)
            : []
        for (const symbol of names) {
          exports.push({
            symbol,
            parameters,
            text: statement.getText(sourceFile),
            callable,
          })
        }
      }
    }
  }
  return exports
}

const hasDirective = (sourceFile: ts.SourceFile, directive: string) =>
  sourceFile.statements.some(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) &&
      statement.expression.text === directive
  )

const databaseImportLocalNames = (sourceFile: ts.SourceFile) =>
  sourceFile.statements.flatMap((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !/(?:^@\/lib\/db$|^\.\/db$|^(?:\.\.\/)+db$|^(?:\.\.\/)+lib\/db$)/.test(
        statement.moduleSpecifier.text
      ) ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) return []
    return statement.importClause.namedBindings.elements.flatMap((element) =>
      element.propertyName?.text === 'db' ||
      (!element.propertyName && element.name.text === 'db')
        ? [element.name.text]
        : []
    )
  })

const containsDbImport = (sourceFile: ts.SourceFile) =>
  databaseImportLocalNames(sourceFile).length > 0

const providerSelectors = (path: string, symbol: string): string[] => {
  if (symbol.includes('accounts.retrieve')) return ['stored.connectAccountId']
  if (symbol.includes('checkout.sessions.list')) {
    return ['createdRange', 'stored.connectAccountId']
  }
  if (symbol.includes('checkout.sessions.create')) {
    return [
      'serverDerivedCart',
      'stored.connectAccountId',
      'stored.funnelId',
    ]
  }
  if (symbol.includes('charges.list')) return ['stored.customerId']
  if (symbol.includes('customers.retrieve')) return ['stored.customerId']
  if (symbol.includes('customers.list')) return ['verifiedPrimaryEmail']
  if (symbol.includes('customers.update')) return ['stored.customerId']
  if (symbol.includes('customers.create')) return ['serverDerivedAgencyProfile']
  if (symbol.includes('subscriptions.retrieve')) return ['stored.subscriptionId']
  if (symbol.includes('subscriptions.update')) return ['stored.subscriptionId']
  if (symbol.includes('subscriptions.create')) return ['stored.customerId']
  if (symbol.includes('products.list')) {
    return path === 'src/app/(main)/agency/[agencyId]/billing/page.tsx'
      ? ['serverConfigured.addOnProducts']
      : ['stored.connectAccountId']
  }
  if (symbol.includes('prices.retrieve')) {
    return ['selected.priceId', 'stored.connectAccountId']
  }
  if (symbol.includes('prices.list')) return ['serverCatalogLookupKeys']
  if (symbol.includes('prices.search')) return ['serverCatalogLookupKey']
  if (symbol.includes('webhooks.constructEvent')) {
    return ['rawBody', 'serverModeSigningSecret', 'signature']
  }
  if (symbol.includes('users.getUser')) return ['providerSubject']
  if (symbol.includes('invitations.createInvitation')) {
    return ['email', 'serverRedirectUrl']
  }
  if (symbol.includes('invitations.revokeInvitation')) {
    return ['providerInvitationId']
  }
  if (symbol.includes('auth.protect')) return ['request.pathname']
  if (symbol.includes('currentUser')) return ['providerSubject']
  if (symbol.includes('createNextRouteHandler')) return ['request.routeSlug']
  return []
}

type ValueImport = { importedName: string; moduleName: string }

const valueImports = (sourceFile: ts.SourceFile) => {
  const imports = new Map<string, ValueImport>()
  for (const statement of sourceFile.statements.filter(ts.isImportDeclaration)) {
    if (
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.importClause ||
      statement.importClause.isTypeOnly
    ) continue
    const moduleName = statement.moduleSpecifier.text
    if (statement.importClause.name) {
      imports.set(statement.importClause.name.text, {
        importedName: 'default',
        moduleName,
      })
    }
    const bindings = statement.importClause.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (element.isTypeOnly) continue
        imports.set(element.name.text, {
          importedName: element.propertyName?.text ?? element.name.text,
          moduleName,
        })
      }
    }
  }
  return imports
}

const unwrapExpression = (input: ts.Expression): ts.Expression => {
  let expression = input
  while (
    ts.isAwaitExpression(expression) ||
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    expression = expression.expression
  }
  return expression
}

const propertyChain = (input: ts.Expression) => {
  const members: string[] = []
  let expression = unwrapExpression(input)
  while (ts.isPropertyAccessExpression(expression)) {
    members.unshift(expression.name.text)
    expression = unwrapExpression(expression.expression)
  }
  return { base: expression, members }
}

const providerCalls = (path: string, sourceFile: ts.SourceFile) => {
  const symbols = new Set<string>()
  const imports = valueImports(sourceFile)
  const stripeFactories = new Set(
    Array.from(imports.entries()).flatMap(([localName, value]) =>
      value.importedName === 'getStripeServerClient' &&
      (value.moduleName === '@/lib/stripe' ||
        (value.moduleName === '.' && path.startsWith('src/lib/stripe/')))
        ? [localName]
        : []
    )
  )
  const stripeConstructors = new Set(
    Array.from(imports.entries()).flatMap(([localName, value]) =>
      value.moduleName === 'stripe' && value.importedName === 'default'
        ? [localName]
        : []
    )
  )
  const stripeRoots = new Set<string>()
  const clerkClientRoots = new Set<string>()
  const injectedIdentifiers = new Map<string, string>()
  const webhookRoots = new Set<string>()

  const collectBindings = (node: ts.Node) => {
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      stripeConstructors.has(node.expression.text)
    ) symbols.add('$provider:stripe.client')
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer)
      if (ts.isCallExpression(initializer)) {
        const target = unwrapExpression(initializer.expression)
        if (ts.isIdentifier(target) && stripeFactories.has(target.text)) {
          stripeRoots.add(node.name.text)
        }
        const chain = propertyChain(initializer.expression)
        if (
          path === 'src/lib/auth/clerk-adapters.ts' &&
          chain.members.join('.') === 'getClient'
        ) clerkClientRoots.add(node.name.text)
      }
      if (
        ts.isNewExpression(initializer) &&
        ts.isIdentifier(initializer.expression) &&
        stripeConstructors.has(initializer.expression.text)
      ) {
        stripeRoots.add(node.name.text)
        symbols.add('$provider:stripe.client')
      }
      const factoryProviders: Record<string, string> = {
        createClerkIdentityProvider: 'clerk.auth',
        createClerkProfileProvider: 'clerk.currentUser',
      }
      const provider = factoryProviders[node.name.text]
      if (
        path === 'src/lib/auth/clerk-adapters.ts' &&
        provider &&
        (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
      ) {
        const parameter = initializer.parameters[0]?.name
        if (parameter && ts.isIdentifier(parameter)) {
          injectedIdentifiers.set(parameter.text, provider)
        }
      }
      if (
        path === 'src/lib/stripe/webhook-intake.ts' &&
        node.name.text === 'createStripeSdkWebhookVerifier' &&
        (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
      ) {
        const parameter = initializer.parameters[0]?.name
        if (parameter && ts.isIdentifier(parameter)) webhookRoots.add(parameter.text)
      }
    }
    ts.forEachChild(node, collectBindings)
  }
  collectBindings(sourceFile)

  const addStripeOperation = (members: string[]) => {
    const operation = members.at(-1) === 'bind'
      ? members.slice(0, -1).join('.')
      : members.join('.')
    if (operation) symbols.add(`$provider:stripe.${operation}`)
  }
  const clerkDirectNames: Record<string, string> = {
    auth: 'auth',
    clerkClient: 'clerkClient',
    clerkMiddleware: 'clerkMiddleware',
    currentUser: 'currentUser',
  }
  const visitCalls = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const target = unwrapExpression(node.expression)
      if (ts.isIdentifier(target)) {
        const imported = imports.get(target.text)
        if (
          imported?.moduleName === '@clerk/nextjs/server' &&
          clerkDirectNames[imported.importedName]
        ) {
          symbols.add(`$provider:clerk.${clerkDirectNames[imported.importedName]}`)
        }
        if (
          imported &&
          ['uploadthing/next', 'uploadthing/server'].includes(imported.moduleName) &&
          ['createUploadthing', 'createNextRouteHandler'].includes(
            imported.importedName
          )
        ) symbols.add(`$provider:uploadthing.${imported.importedName}`)
        const injected = injectedIdentifiers.get(target.text)
        if (injected) symbols.add(`$provider:${injected}`)
      } else if (ts.isPropertyAccessExpression(target)) {
        const chain = propertyChain(target)
        if (ts.isIdentifier(chain.base)) {
          const root = chain.base.text
          if (stripeRoots.has(root)) addStripeOperation(chain.members)
          const imported = imports.get(root)
          if (
            imported?.moduleName === '@clerk/nextjs/server' &&
            imported.importedName === 'auth' &&
            chain.members.join('.') === 'protect'
          ) symbols.add('$provider:clerk.auth.protect')
          if (
            path === 'src/middleware.ts' &&
            root === 'auth' &&
            chain.members.join('.') === 'protect'
          ) symbols.add('$provider:clerk.auth.protect')
          if (
            clerkClientRoots.has(root) &&
            chain.members[0] === 'invitations' &&
            ['createInvitation', 'revokeInvitation'].includes(
              chain.members[1] ?? ''
            )
          ) symbols.add(`$provider:clerk.${chain.members.join('.')}`)
          if (
            path === 'src/lib/auth/clerk-adapters.ts' &&
            root === 'values' &&
            chain.members.join('.') === 'getClient'
          ) symbols.add('$provider:clerk.clerkClient')
          if (
            webhookRoots.has(root) &&
            ['constructEvent', 'constructEventAsync'].includes(
              chain.members.join('.')
            )
          ) symbols.add(`$provider:stripe.webhooks.${chain.members.join('.')}`)
          if (
            path === 'src/lib/stripe/webhook-processor.ts' &&
            root === 'dependencies' &&
            chain.members.join('.') === 'provider.retrieveSubscription'
          ) symbols.add('$provider:stripe.subscriptions.retrieve')
          if (
            path === 'src/lib/stripe/webhook-processor.ts' &&
            root === 'dependencies' &&
            chain.members.join('.') === 'provider.retrieveCustomer'
          ) symbols.add('$provider:stripe.customers.retrieve')
        } else if (ts.isCallExpression(chain.base)) {
          const factory = unwrapExpression(chain.base.expression)
          if (ts.isIdentifier(factory) && stripeFactories.has(factory.text)) {
            addStripeOperation(chain.members)
          }
        }
      }
    }
    ts.forEachChild(node, visitCalls)
  }
  visitCalls(sourceFile)

  return Array.from(symbols)
    .sort()
    .map((symbol) => ({ symbol, selectors: providerSelectors(path, symbol) }))
}

const effectsFromText = (
  _symbol: string,
  text: string,
  fallback: Effect = 'read'
): Effect[] => {
  const effects = new Set<Effect>()
  const lower = text.toLowerCase()
  if (/\b(find|list|get|search|read|count|aggregate)\w*\s*\(/.test(lower)) {
    effects.add('read')
  }
  if (/\b(create|insert|provision|invite|submit|receive)\w*\s*\(/.test(lower)) {
    effects.add('create')
  }
  if (/\b(update|upsert|configure|sync|change|grant|revoke|accept)\w*\s*\(/.test(lower)) {
    effects.add('update')
  }
  if (/\b(delete|remove)\w*\s*\(/.test(lower)) effects.add('delete')
  if (/\b(reorder|order)\w*\s*\(/.test(lower)) effects.add('reorder')
  if (
    /\b(?:getstripeserverclient|clerkclient|currentuser|auth|getauth|getcurrentuser|createuploadthing|createnextroutehandler)\s*\(/.test(
      lower
    ) ||
    /\b(?:provider|webhooks)\s*\.\s*\w+\s*\(/.test(lower) ||
    /\.\s*invitations\s*\.\s*(?:createinvitation|revokeinvitation)\s*\(/.test(
      lower
    )
  ) {
    effects.add('external call')
  }
  if (/\b(notification|activity)\b/.test(lower)) effects.add('notification')
  if (/\brevalidate(path|tag)?\b/.test(lower)) effects.add('revalidation')
  if (/\bconsole\.(log|error|warn)\b/.test(lower)) effects.add('log')
  if (effects.size === 0) effects.add(fallback)
  if (effects.size > 3) return ['composite']
  return Array.from(effects).sort()
}

const queryEffects: Record<string, Effect[]> = {
  getAuthUserDetails: ['read'],
  updateAgencyGoal: ['update'],
  deleteAgency: ['delete'],
  upsertAgency: ['read', 'create', 'update'],
  upsertSubAccount: ['read', 'create', 'update'],
  deleteSubAccount: ['delete'],
  getMedia: ['read'],
  createMedia: ['create'],
  deleteMedia: ['delete'],
  getPipelineDetails: ['read'],
  getLanesWithTicketAndTags: ['read'],
  upsertFunnel: ['read', 'create', 'update'],
  upsertPipeline: ['create', 'update'],
  deletePipeline: ['delete'],
  updateLanesOrder: ['update', 'reorder'],
  updateTicketsOrder: ['update', 'reorder'],
  upsertLane: ['read', 'create', 'update'],
  deleteLane: ['delete'],
  getTicketsWithTags: ['read'],
  _getTicketsWithAllRelations: ['read'],
  getSubAccountTeamMembers: ['read'],
  listContacts: ['read'],
  searchContacts: ['read'],
  upsertTicket: ['read', 'create', 'update'],
  deleteTicket: ['delete'],
  upsertTag: ['create', 'update'],
  getTagsForSubaccount: ['read'],
  deleteTag: ['delete'],
  createContact: ['create'],
  updateContact: ['update'],
  submitPublicLead: ['create'],
  getFunnels: ['read'],
  getFunnel: ['read'],
  upsertFunnelPage: ['create', 'update', 'revalidation'],
  deleteFunnelePage: ['delete', 'revalidation'],
  getFunnelPageDetails: ['read'],
  getDomainContent: ['read'],
  getPipelines: ['read'],
}

const actionEffects: Record<string, Effect[]> = {
  verifyAndAcceptInvitation: ['read', 'create', 'delete', 'external call'],
  provisionAgencyOwner: ['read', 'create', 'external call'],
  listAgencyTeam: ['read'],
  getMemberPermissions: ['read'],
  getTeamMember: ['read'],
  updateMyProfile: ['update'],
  changeMemberRole: ['read', 'update'],
  grantMemberPermission: ['read', 'create', 'update'],
  revokeMemberPermission: ['read', 'update'],
  removeMember: ['read', 'delete'],
  inviteMember: ['read', 'create', 'external call'],
  configureFunnelProducts: ['read', 'update', 'external call'],
  listConnectedProducts: ['read', 'external call'],
}

const apiEffects: Record<string, Effect[]> = {
  'src/app/api/stripe/create-customer/route.ts#POST': [
    'read',
    'create',
    'update',
    'external call',
  ],
  'src/app/api/stripe/create-subscription/route.ts#POST': [
    'read',
    'create',
    'update',
    'external call',
  ],
  'src/app/api/stripe/create-checkout-session/route.ts#POST': [
    'read',
    'external call',
  ],
  'src/app/api/stripe/webhook/route.ts#POST': ['read', 'create'],
  'src/app/api/uploadthing/route.ts#GET': ['read', 'upload grant'],
  'src/app/api/uploadthing/route.ts#POST': [
    'upload grant',
    'external call',
  ],
}

const internalEffectOverrides: Record<string, Effect[]> = {
  'src/features/agency-projections/server-projection-service.ts#agencyProjectionService': [
    'read',
  ],
  'src/features/notifications/activity-foundation-service.ts#createActivityFoundationService': [
    'no-op boundary',
  ],
  'src/features/notifications/notification-view-service.ts#assertNotificationViewAction': [
    'no-op boundary',
  ],
  'src/features/notifications/notification-view-service.ts#createNotificationViewService': [
    'read',
  ],
  'src/features/notifications/server-notification-view-service.ts#$db': [
    'read',
  ],
  'src/features/notifications/server-notification-view-service.ts#notificationViewService': [
    'read',
  ],
  'src/lib/stripe/billing-catalog-server.ts#getCrewframePriceForPlan': [
    'external call',
    'read',
  ],
  'src/lib/stripe/billing-catalog-server.ts#getCrewframePriceOptions': [
    'external call',
    'read',
  ],
}

const loaderEffects = (path: string, text: string): Effect[] => {
  const effects = new Set<Effect>(['read'])
  if (/\bdb\.\w+\.create\w*\s*\(/.test(text)) effects.add('create')
  if (/\bdb\.\w+\.update\w*\s*\(/.test(text)) effects.add('update')
  if (/\bdb\.\w+\.delete\w*\s*\(/.test(text)) effects.add('delete')
  if (
    /\bgetStripeServerClient\s*\(|\bgetCrewframePriceOptions\s*\(|\bstripe\.\w+\./.test(
      text
    )
  ) effects.add('external call')
  if (
    path === 'src/app/(main)/agency/page.tsx' &&
    /verifyAndAcceptInvitation|provisionAgencyOwner/.test(text)
  ) return ['composite']
  return Array.from(effects).sort()
}

const effectsForSurface = (
  path: string,
  symbol: string,
  invocation: Invocation,
  text: string
): Effect[] => {
  const override =
    (path === 'src/lib/queries.ts' ? queryEffects[symbol] : undefined) ??
    (invocation === 'server action' ? actionEffects[symbol] : undefined) ??
    (invocation === 'API handler' ? apiEffects[`${path}#${symbol}`] : undefined) ??
    internalEffectOverrides[`${path}#${symbol}`]
  if (override) return [...override].sort()
  if (invocation.includes('loader')) return loaderEffects(path, text)
  return effectsFromText(symbol, text)
}

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const databaseEffects = (text: string, localNames: string[]): Effect[] => {
  const effects = new Set<Effect>()
  const identifiers = Array.from(new Set([...localNames, 'tx']))
    .map(escapeRegex)
    .join('|')
  const methodPattern = new RegExp(
    `\\b(?:${identifiers})\\.\\w+\\.(findUnique|findFirst|findMany|count|aggregate|create|createMany|update|updateMany|upsert|delete|deleteMany)\\s*\\(`,
    'g'
  )
  for (const match of Array.from(text.matchAll(
    methodPattern
  ))) {
    const method = match[1] ?? ''
    if (/^(?:find|count|aggregate)/.test(method)) effects.add('read')
    if (/^create/.test(method)) effects.add('create')
    if (/^update/.test(method)) effects.add('update')
    if (method === 'upsert') {
      effects.add('create')
      effects.add('update')
    }
    if (/^delete/.test(method)) effects.add('delete')
  }
  if (
    localNames.some((name) =>
      new RegExp(`\\b${escapeRegex(name)}\\.\\$transaction\\s*\\(`).test(text)
    )
  ) effects.add('composite')
  if (effects.size === 0) effects.add('composite')
  return Array.from(effects).sort()
}

const uploadRouteSlugs = (sourceFile: ts.SourceFile) => {
  const symbols: string[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'ourFileRouter' &&
      node.initializer &&
      ts.isSatisfiesExpression(node.initializer) &&
      ts.isObjectLiteralExpression(node.initializer.expression)
    ) {
      for (const property of node.initializer.expression.properties) {
        if (ts.isPropertyAssignment(property)) {
          const name = property.name
          if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
            symbols.push(name.text)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return symbols.sort()
}

const isBoundaryModule = (path: string) =>
  /(^|\/)src\/features\/.*(?:service|upload-auth)\.ts$/.test(path) ||
  /(^|\/)src\/lib\/auth\/.*\.ts$/.test(path) ||
  path === 'src/lib/http/request-integrity.ts' ||
  /(^|\/)src\/lib\/stripe\/.*\.ts$/.test(path) ||
  path === 'src/lib/routing/middleware-routing.ts'

const routeSelectors = (path: string) =>
  Array.from(path.matchAll(/\[+(?:\.\.\.)?([^\]]+)\]+/g))
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value))
    .sort()

const addSurface = (
  target: Map<string, DiscoveredSurface>,
  input: Omit<DiscoveredSurface, 'surfaceId'>
) => {
  const surfaceId = `${input.invocation}:${input.path}#${input.symbol}`
  if (target.has(surfaceId)) throw new Error(`duplicate discovery ${surfaceId}`)
  target.set(surfaceId, { surfaceId, ...input })
}

export const discoverRepository = (rootInput: string): DiscoveredSurface[] => {
  const root = resolve(rootInput)
  const surfaces = new Map<string, DiscoveredSurface>()

  for (const absolute of walkSource(root)) {
    const path = normalizePath(relative(root, absolute))
    const text = normalizeText(readFileSync(absolute, 'utf8'))
    const sourceHash = canonicalHash(text)
    const sourceFile = ts.createSourceFile(
      path,
      text,
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    const exports = runtimeExports(sourceFile, true)
    const useServer = hasDirective(sourceFile, 'use server')
    const useClient = hasDirective(sourceFile, 'use client')

    if (useServer) {
      for (const value of exports.filter((item) => item.symbol !== 'default')) {
        addSurface(surfaces, {
          path,
          symbol: value.symbol,
          invocation: 'server action',
          parameterNames: value.parameters,
          observedEffects: effectsForSurface(
            path,
            value.symbol,
            'server action',
            value.text
          ),
          sourceHash,
        })
      }
    }

    if (/\/route\.tsx?$/.test(path)) {
      for (const value of exports.filter((item) => HTTP_METHODS.has(item.symbol))) {
        addSurface(surfaces, {
          path,
          symbol: value.symbol,
          invocation: 'API handler',
          parameterNames: value.parameters.length ? value.parameters : ['request'],
          observedEffects: effectsForSurface(
            path,
            value.symbol,
            'API handler',
            value.text
          ),
          sourceHash,
        })
      }
    }

    if (!useClient && /\/(page|layout)\.tsx?$/.test(path)) {
      const defaultExport = exports.find((item) => item.symbol === 'default')
      if (defaultExport) {
        const publicLoader =
          path.startsWith('src/app/[domain]/') ||
          path === 'src/app/[domain]/page.tsx' ||
          path.startsWith('src/app/site/')
        addSurface(surfaces, {
          path,
          symbol: 'default',
          invocation: publicLoader
            ? 'public loader'
            : path.endsWith('/layout.tsx')
              ? 'layout loader'
              : 'page loader',
          parameterNames: routeSelectors(path),
          observedEffects: effectsForSurface(
            path,
            'default',
            publicLoader
              ? 'public loader'
              : path.endsWith('/layout.tsx')
                ? 'layout loader'
                : 'page loader',
            text
          ),
          sourceHash,
        })
      }
    }

    if (containsDbImport(sourceFile)) {
      addSurface(surfaces, {
        path,
        symbol: '$db',
        invocation: 'internal-only',
        parameterNames: [],
        observedEffects: databaseEffects(
          text,
          databaseImportLocalNames(sourceFile)
        ),
        sourceHash,
      })
    }

    if (path === 'src/app/api/uploadthing/core.ts') {
      for (const slug of uploadRouteSlugs(sourceFile)) {
        addSurface(surfaces, {
          path,
          symbol: `$upload-route:${slug}`,
          invocation: 'upload router/callback',
          parameterNames: [],
          observedEffects: ['upload grant'],
          sourceHash,
        })
        addSurface(surfaces, {
          path,
          symbol: `$upload-callback:${slug}`,
          invocation: 'upload router/callback',
          parameterNames: [],
          observedEffects: ['no-op boundary'],
          sourceHash,
        })
      }
      addSurface(surfaces, {
        path,
        symbol: '$upload-authenticate',
        invocation: 'internal-only',
        parameterNames: [],
        observedEffects: ['upload grant'],
        sourceHash,
      })
    }

    if (!useClient) {
      for (const provider of providerCalls(path, sourceFile)) {
        addSurface(surfaces, {
          path,
          symbol: provider.symbol,
          invocation: 'provider callback',
          parameterNames: provider.selectors,
          observedEffects: ['external call'],
          sourceHash,
        })
      }
    }

    if (isBoundaryModule(path) && !useServer) {
      for (const value of exports.filter(
        (item) => item.symbol !== 'default' && item.callable
      )) {
        addSurface(surfaces, {
          path,
          symbol: value.symbol,
          invocation: 'internal-only',
          parameterNames: value.parameters,
          observedEffects: effectsForSurface(
            path,
            value.symbol,
            'internal-only',
            value.text
          ),
          sourceHash,
        })
      }
    }

    if (path === 'src/lib/types.ts' && text.includes('const __getUsersWithAgencySubAccountPermissionsSidebarOptions')) {
      addSurface(surfaces, {
        path,
        symbol: '__getUsersWithAgencySubAccountPermissionsSidebarOptions',
        invocation: 'internal-only',
        parameterNames: ['agencyId'],
        observedEffects: ['read'],
        sourceHash,
      })
    }

    if (path === 'src/middleware.ts') {
      addSurface(surfaces, {
        path,
        symbol: 'default',
        invocation: 'provider callback',
        parameterNames: ['auth', 'request'],
        observedEffects: ['read'],
        sourceHash,
      })
    }
  }

  return Array.from(surfaces.values()).sort((left, right) =>
    left.surfaceId.localeCompare(right.surfaceId)
  )
}

const queryRequestedIds: Record<string, string[]> = {
  getAuthUserDetails: [],
  updateAgencyGoal: ['agencyId', 'goal'],
  deleteAgency: ['agencyId'],
  upsertAgency: ['agency.id'],
  upsertSubAccount: ['subaccount.id'],
  deleteSubAccount: ['subaccountId'],
  getMedia: ['subaccountId'],
  createMedia: ['media.id', 'media.subAccountId', 'media.url'],
  deleteMedia: ['mediaId'],
  getPipelineDetails: ['pipelineId'],
  getLanesWithTicketAndTags: ['pipelineId'],
  upsertFunnel: ['funnel.id', 'funnel.subAccountId'],
  upsertPipeline: ['pipeline.id', 'pipeline.subAccountId'],
  deletePipeline: ['pipelineId'],
  updateLanesOrder: ['lane[].id', 'lane[].pipelineId'],
  updateTicketsOrder: ['ticket[].id', 'ticket[].laneId'],
  upsertLane: ['lane.id', 'lane.pipelineId'],
  deleteLane: ['laneId'],
  getTicketsWithTags: ['pipelineId'],
  _getTicketsWithAllRelations: ['laneId'],
  getSubAccountTeamMembers: ['subaccountId'],
  listContacts: ['subaccountId'],
  searchContacts: ['query', 'subaccountId'],
  upsertTicket: [
    'ticket.assignedUserId',
    'ticket.customerId',
    'ticket.id',
    'ticket.laneId',
    'ticket.tagIds',
  ],
  deleteTicket: ['ticketId'],
  upsertTag: ['subaccountId', 'tag.id'],
  getTagsForSubaccount: ['subaccountId'],
  deleteTag: ['tagId'],
  createContact: ['contact.email', 'contact.name', 'contact.subaccountId'],
  updateContact: [
    'contact.email',
    'contact.id',
    'contact.name',
    'contact.subaccountId',
  ],
  submitPublicLead: ['lead.email', 'lead.funnelId', 'lead.name'],
  getFunnels: ['subaccountId'],
  getFunnel: ['funnelId'],
  upsertFunnelPage: ['funnelPage.funnelId', 'funnelPage.id'],
  deleteFunnelePage: ['funnelPageId'],
  getFunnelPageDetails: ['funnelPageId'],
  getDomainContent: ['subDomainName'],
  getPipelines: ['subaccountId'],
}

const teamActionRequestedIds: Record<string, string[]> = {
  listAgencyTeam: ['agencyId'],
  getMemberPermissions: ['targetUserId'],
  getTeamMember: ['targetUserId'],
  updateMyProfile: [],
  changeMemberRole: ['targetUserId'],
  grantMemberPermission: ['subaccountId', 'targetUserId'],
  revokeMemberPermission: ['subaccountId', 'targetUserId'],
  removeMember: ['targetUserId'],
  inviteMember: ['email'],
}

const apiRequestedIds: Record<string, string[]> = {
  'src/app/api/stripe/create-customer/route.ts#POST': [
    'body.agencyId',
    'body.operationId',
  ],
  'src/app/api/stripe/create-subscription/route.ts#POST': [
    'body.agencyId',
    'body.operationId',
    'body.plan',
  ],
  'src/app/api/stripe/create-checkout-session/route.ts#POST': [
    'body.funnelId',
    'body.operationId',
  ],
  'src/app/api/stripe/webhook/route.ts#POST': [
    'header.stripe-signature',
    'request.rawBody',
  ],
  'src/app/api/uploadthing/route.ts#GET': ['request.routeSlug'],
  'src/app/api/uploadthing/route.ts#POST': [
    'request.file',
    'request.routeSlug',
  ],
}

const b5a2aAcceptedSurfaces = new Set([
  'internal-only:src/features/agency-projections/projection-service.ts#createProjectionService',
  'internal-only:src/features/agency-projections/server-projection-service.ts#$db',
  'internal-only:src/features/agency-projections/server-projection-service.ts#agencyProjectionService',
  'layout loader:src/app/(main)/agency/[agencyId]/layout.tsx#default',
  'layout loader:src/app/(main)/subaccount/[subaccountId]/layout.tsx#default',
  'page loader:src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx#default',
  'page loader:src/app/(main)/agency/[agencyId]/settings/page.tsx#default',
  'page loader:src/app/(main)/agency/page.tsx#default',
  'page loader:src/app/(main)/subaccount/[subaccountId]/settings/page.tsx#default',
  'page loader:src/app/(main)/subaccount/page.tsx#default',
  'provider callback:src/app/(main)/agency/page.tsx#$provider:clerk.currentUser',
  'server action:src/features/agency-projections/actions.ts#listTicketAssigneeOptions',
  'internal-only:src/features/notifications/notification-view-service.ts#assertNotificationViewAction',
  'internal-only:src/features/notifications/notification-view-service.ts#createNotificationViewService',
  'internal-only:src/features/notifications/server-notification-view-service.ts#$db',
  'internal-only:src/features/notifications/server-notification-view-service.ts#notificationViewService',
])

const b5a2aActions: Readonly<Record<string, Action>> = {
  'layout loader:src/app/(main)/agency/[agencyId]/layout.tsx#default':
    'agency:view',
  'layout loader:src/app/(main)/subaccount/[subaccountId]/layout.tsx#default':
    'subaccount:view',
  'page loader:src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx#default':
    'agency:view',
  'page loader:src/app/(main)/agency/[agencyId]/settings/page.tsx#default':
    'agency:view',
  'page loader:src/app/(main)/agency/page.tsx#default': 'account:entry',
  'page loader:src/app/(main)/subaccount/[subaccountId]/settings/page.tsx#default':
    'subaccount:view',
  'page loader:src/app/(main)/subaccount/page.tsx#default': 'subaccount:view',
  'provider callback:src/app/(main)/agency/page.tsx#$provider:clerk.currentUser':
    'account:entry',
  'server action:src/features/agency-projections/actions.ts#listTicketAssigneeOptions':
    'team:read',
}

const b5a2aPersistencePredicates: Readonly<Record<string, string>> = {
  'internal-only:src/features/agency-projections/projection-service.ts#createProjectionService':
    'provider subject resolves actor context; every requested tenant is bound to actor.agencyId',
  'internal-only:src/features/agency-projections/server-projection-service.ts#$db':
    'operation-specific actor, agency, subaccount, permission, and role predicates are conjunctive',
  'internal-only:src/features/agency-projections/server-projection-service.ts#agencyProjectionService':
    'server-derived actor context selects only purpose-specific DTO fields',
  'layout loader:src/app/(main)/agency/[agencyId]/layout.tsx#default':
    'actor.agencyId = requested agency.id',
  'layout loader:src/app/(main)/subaccount/[subaccountId]/layout.tsx#default':
    'actor.agencyId = requested subAccount.agencyId AND permission is active when required',
  'page loader:src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx#default':
    'actor.agencyId = requested agency.id AND every subAccount.agencyId = actor.agencyId',
  'page loader:src/app/(main)/agency/[agencyId]/settings/page.tsx#default':
    'actor.id and requested agency.id share actor.agencyId',
  'page loader:src/app/(main)/agency/page.tsx#default':
    'actor.id = authenticated provider subject; onboarding performs no tenant query',
  'page loader:src/app/(main)/subaccount/[subaccountId]/settings/page.tsx#default':
    'actor.agencyId = requested subAccount.agencyId AND actor permission is active when required',
  'page loader:src/app/(main)/subaccount/page.tsx#default':
    'permission.User.id = actor.id AND permission.SubAccount.agencyId = actor.agencyId AND access = true',
  'provider callback:src/app/(main)/agency/page.tsx#$provider:clerk.currentUser':
    'provider profile supplies onboarding email display only and grants no authority',
  'server action:src/features/agency-projections/actions.ts#listTicketAssigneeOptions':
    'permission.subAccountId = requested subaccount AND access = true AND user and subaccount share actor.agencyId',
}

const domainFor = (surface: DiscoveredSurface): Domain => {
  const { path, symbol } = surface
  if (
    surface.surfaceId ===
    'provider callback:src/app/(main)/agency/page.tsx#$provider:clerk.currentUser'
  ) return 'identity/account'
  if (
    surface.surfaceId ===
    'server action:src/features/agency-projections/actions.ts#listTicketAssigneeOptions'
  ) return 'team/permission/invitation'
  const queryDomains: Record<string, Domain> = {
    getAuthUserDetails: 'identity/account',
    updateAgencyGoal: 'agency',
    deleteAgency: 'agency',
    upsertAgency: 'agency',
    upsertSubAccount: 'subaccount',
    deleteSubAccount: 'subaccount',
    getMedia: 'upload/media',
    createMedia: 'upload/media',
    deleteMedia: 'upload/media',
    getPipelineDetails: 'pipeline/lane/tag',
    getLanesWithTicketAndTags: 'ticket/relations',
    upsertFunnel: 'funnel/page/editor',
    upsertPipeline: 'pipeline/lane/tag',
    deletePipeline: 'pipeline/lane/tag',
    updateLanesOrder: 'pipeline/lane/tag',
    updateTicketsOrder: 'ticket/relations',
    upsertLane: 'pipeline/lane/tag',
    deleteLane: 'pipeline/lane/tag',
    getTicketsWithTags: 'ticket/relations',
    _getTicketsWithAllRelations: 'ticket/relations',
    getSubAccountTeamMembers: 'team/permission/invitation',
    listContacts: 'contact',
    searchContacts: 'contact',
    upsertTicket: 'ticket/relations',
    deleteTicket: 'ticket/relations',
    upsertTag: 'pipeline/lane/tag',
    getTagsForSubaccount: 'pipeline/lane/tag',
    deleteTag: 'pipeline/lane/tag',
    createContact: 'contact',
    updateContact: 'contact',
    submitPublicLead: 'contact',
    getFunnels: 'funnel/page/editor',
    getFunnel: 'funnel/page/editor',
    upsertFunnelPage: 'funnel/page/editor',
    deleteFunnelePage: 'funnel/page/editor',
    getFunnelPageDetails: 'funnel/page/editor',
    getDomainContent: 'routing/public',
    getPipelines: 'ticket/relations',
  }
  if (path === 'src/lib/queries.ts' && queryDomains[symbol]) {
    return queryDomains[symbol]
  }
  if (path.includes('/api/uploadthing') || path.includes('/features/uploads/')) return 'upload/media'
  if (path.includes('/api/stripe') || path.includes('/features/billing/') || path.includes('/features/commerce/') || path.includes('/lib/stripe/') || path.includes('/billing/')) return 'billing/commerce/webhook'
  if (path.includes('/features/contacts/') || path.includes('/contacts/') || /contact|publicLead/i.test(symbol)) return 'contact'
  if (path.includes('/features/team/') || path.includes('/team/') || /Team|Member|Permission|invite/i.test(symbol)) return 'team/permission/invitation'
  if (path.includes('/agency/(auth)/')) return 'identity/account'
  if (path.includes('/features/accounts/') || path.includes('/lib/auth/')) return 'identity/account'
  if (path.includes('/features/notifications/')) return 'notification/activity'
  if (/notification|activity/i.test(symbol)) return 'notification/activity'
  if (/media/i.test(symbol) || path.includes('/media/')) return 'upload/media'
  if (/funnel/i.test(symbol) || path.includes('/funnels/')) return 'funnel/page/editor'
  if (/ticket/i.test(symbol)) return 'ticket/relations'
  if (/^(?:get|upsert|delete|update)?(?:Pipeline|Lane|Tag)/.test(symbol) || path.includes('/pipelines/')) return 'pipeline/lane/tag'
  if (/getDomainContent/i.test(symbol) || path.includes('src/app/[domain]') || path.includes('src/app/site/')) return 'routing/public'
  if (/getAuthUserDetails/i.test(symbol)) return 'identity/account'
  if (/subaccount/i.test(symbol) || path.includes('/subaccount/')) return 'subaccount'
  if (/agency/i.test(symbol) || path.includes('/agency/')) return 'agency'
  if (path.includes('/routing/')) return 'routing/public'
  return 'internal persistence'
}

const dispositionFor = (
  surface: DiscoveredSurface,
  domain: Domain
): Disposition => {
  const { path, symbol } = surface
  if (
    surface.surfaceId ===
    'internal-only:src/features/notifications/activity-foundation-service.ts#createActivityFoundationService'
  ) return 'DORMANT_BLOCKED'
  if (b5a2aAcceptedSurfaces.has(surface.surfaceId)) return 'ACCEPTED_RETAIN'
  if (path.startsWith('src/app/site/')) return 'ACCEPTED_RETAIN'
  if (
    path.startsWith('src/app/[domain]/') ||
    path === 'src/app/[domain]/page.tsx' ||
    path.includes('/agency/(auth)/sign-') ||
    surface.invocation === 'public loader' ||
    (path.includes('/features/contacts/') && /publicLead/i.test(symbol)) ||
    /submitPublicLead|getDomainContent/.test(symbol)
  ) return 'PUBLIC_REVIEW_REQUIRED'
  if (
    path === 'src/app/(main)/agency/(auth)/layout.tsx' ||
    path === 'src/app/(main)/agency/unauthorized/page.tsx' ||
    path.includes('/agency/[agencyId]/billing/page.tsx') ||
    path.includes('/agency/[agencyId]/page.tsx') ||
    path.includes('/agency/[agencyId]/team/page.tsx') ||
    path.includes('/subaccount/[subaccountId]/page.tsx') ||
    path.includes('/subaccount/[subaccountId]/contacts/page.tsx')
  ) return 'ACCEPTED_RETAIN'
  if (
    path.includes('/agency/[agencyId]/settings/page.tsx') ||
    path.includes('/agency/[agencyId]/all-subaccounts/page.tsx') ||
    path.includes('/agency/[agencyId]/layout.tsx') ||
    path === 'src/app/(main)/agency/page.tsx' ||
    path.includes('/subaccount/[subaccountId]/settings/page.tsx') ||
    path.includes('/subaccount/[subaccountId]/layout.tsx') ||
    path === 'src/app/(main)/subaccount/page.tsx' ||
    path === 'src/lib/types.ts'
  ) return 'B5A2'
  if (
    symbol === 'getAuthUserDetails' ||
    symbol === 'getSubAccountTeamMembers'
  ) return 'B5A2'
  if (
    path.includes('/lib/stripe/subscription-sync.ts') ||
    path.includes('/lib/stripe/prisma-webhook-processing-store') ||
    path.includes('/lib/stripe/webhook-processing') ||
    path.includes('/lib/stripe/webhook-processor.ts') ||
    path.includes('/lib/stripe/webhook-worker.ts') ||
    path.includes('/lib/stripe/webhook-replay.ts')
  ) return 'DORMANT_BLOCKED'
  if (
    path.includes('/subaccount/[subaccountId]/pipelines/[pipelineId]/page.tsx') ||
    (path === 'src/lib/queries.ts' && symbol === 'getPipelines')
  ) return 'B5A6'
  if (domain === 'notification/activity') return 'B5A2'
  if (domain === 'upload/media') return 'B5A3'
  if (domain === 'funnel/page/editor') return 'B5A4'
  if (domain === 'pipeline/lane/tag') return 'B5A5'
  if (domain === 'ticket/relations') return 'B5A6'
  if (domain === 'automation') return 'B5A8'
  if (domain === 'agency' || domain === 'subaccount') return 'B5A7'
  if (path === 'src/lib/queries.ts' && symbol === '$db') return 'B5A8'
  return 'ACCEPTED_RETAIN'
}

const ownershipFor = (domain: Domain): string[] => {
  switch (domain) {
    case 'agency':
      return ['Agency']
    case 'subaccount':
      return ['Agency', 'SubAccount']
    case 'team/permission/invitation':
      return ['Agency', 'User', 'Permission|Invitation']
    case 'billing/commerce/webhook':
      return ['Agency', 'SubAccount?', 'ProviderBinding']
    case 'contact':
      return ['Agency', 'SubAccount', 'Contact']
    case 'notification/activity':
      return ['Agency', 'SubAccount?', 'Notification']
    case 'upload/media':
      return ['Agency', 'SubAccount?', 'UploadIntent|Media']
    case 'funnel/page/editor':
      return ['Agency', 'SubAccount', 'Funnel', 'FunnelPage?']
    case 'pipeline/lane/tag':
      return ['Agency', 'SubAccount', 'Pipeline', 'Lane?', 'Tag?']
    case 'ticket/relations':
      return ['Agency', 'SubAccount', 'Pipeline', 'Lane', 'Ticket', 'Contact|Assignee|Tag?']
    case 'routing/public':
      return ['PublishedDomain', 'Funnel', 'FunnelPage?']
    case 'identity/account':
      return ['ProviderSubject', 'Actor', 'Agency?']
    default:
      return ['InternalBoundary']
  }
}

const actionFor = (
  surface: DiscoveredSurface,
  disposition: Disposition
): Action => {
  const b5a2aAction = b5a2aActions[surface.surfaceId]
  if (b5a2aAction) return b5a2aAction
  if (
    surface.surfaceId ===
    'internal-only:src/features/notifications/activity-foundation-service.ts#createActivityFoundationService'
  ) return 'INTERNAL_ONLY'
  if (disposition === 'PUBLIC_REVIEW_REQUIRED') return 'PUBLIC_BOUNDED'
  if (disposition === 'DORMANT_BLOCKED' || disposition.startsWith('B5A')) {
    return 'UNDEFINED_BLOCKED'
  }
  const exact: Record<string, string> = {
    verifyAndAcceptInvitation: 'account:entry',
    provisionAgencyOwner: 'account:provision',
    listAgencyTeam: 'team:list',
    getMemberPermissions: 'team:read',
    getTeamMember: 'team:read',
    updateMyProfile: 'team:self-update',
    changeMemberRole: 'team:manage',
    grantMemberPermission: 'team:manage',
    revokeMemberPermission: 'team:manage',
    removeMember: 'team:manage',
    inviteMember: 'team:invite',
    listContacts: 'contact:list',
    searchContacts: 'contact:search',
    createContact: 'contact:create',
    updateContact: 'contact:update',
    configureFunnelProducts: 'commerce:configure',
    listConnectedProducts: 'commerce:catalog',
  }
  if (surface.path.includes('/stripe/webhook/route.ts')) return 'webhook:receive'
  if (surface.path.includes('/api/stripe/create-')) {
    return surface.path.includes('checkout')
      ? 'commerce:checkout'
      : 'billing:manage'
  }
  if (surface.path.startsWith('src/app/site/')) return 'PUBLIC_BOUNDED'
  return (exact[surface.symbol] as Action | undefined) ?? 'INTERNAL_ONLY'
}

const requestedIdsFor = (surface: DiscoveredSurface) => {
  if (
    surface.surfaceId ===
    'server action:src/features/agency-projections/actions.ts#listTicketAssigneeOptions'
  ) return ['subaccountId']
  if (surface.path.startsWith('src/features/agency-projections/')) return []
  if (surface.path === 'src/lib/queries.ts' && queryRequestedIds[surface.symbol]) {
    return queryRequestedIds[surface.symbol]
  }
  if (surface.path === 'src/features/team/actions.ts' && teamActionRequestedIds[surface.symbol]) {
    return teamActionRequestedIds[surface.symbol]
  }
  const apiIds = apiRequestedIds[`${surface.path}#${surface.symbol}`]
  if (apiIds) return apiIds
  if (surface.symbol.startsWith('$upload-callback:')) return []
  if (surface.symbol.startsWith('$upload-route:')) {
    return ['file.name', 'file.size', 'routeSlug']
  }
  if (surface.symbol === '$upload-authenticate') return []
  if (
    surface.path === 'src/features/commerce/actions.ts' &&
    surface.symbol === 'configureFunnelProducts'
  ) return ['input.funnelId', 'input.selections[].productId']
  if (
    surface.path === 'src/features/commerce/actions.ts' &&
    surface.symbol === 'listConnectedProducts'
  ) return ['subaccountId']
  if (surface.invocation === 'provider callback') {
    return Array.from(
      new Set([...routeSelectors(surface.path), ...surface.parameterNames])
    ).sort()
  }
  const routeIds = routeSelectors(surface.path)
  if (routeIds.length) return routeIds
  if (surface.invocation === 'API handler') {
    return surface.parameterNames.filter((name) => /id|request|input/i.test(name))
  }
  if (surface.invocation === 'internal-only') {
    return surface.parameterNames
      .filter((name) =>
        /id|email|domain|path|request|input|subscription|receipt|event|limit|operation/i.test(
          name
        )
      )
      .sort()
  }
  return surface.parameterNames.filter((name) => /id|email|domain|path/i.test(name))
}

const persistencePredicateFor = (domain: Domain, effects: Effect[]) => {
  const mutation = effects.some((effect) =>
    ['create', 'update', 'delete', 'reorder', 'composite'].includes(effect)
  )
  const suffix = mutation
    ? ' AND expected-state matches AND affected-count = 1'
    : ''
  switch (domain) {
    case 'agency':
      return `actor.agencyId = agency.id${suffix}`
    case 'subaccount':
      return `actor.agencyId = subAccount.agencyId AND subAccount.id = requestedSubaccountId${suffix}`
    case 'funnel/page/editor':
      return `funnel.subAccountId = subAccount.id AND page.funnelId = funnel.id${suffix}`
    case 'pipeline/lane/tag':
      return `pipeline.subAccountId = subAccount.id AND lane.pipelineId = pipeline.id${suffix}`
    case 'ticket/relations':
      return `ticket.lane.pipeline.subAccountId = subAccount.id AND every related resource shares subAccount.id${suffix}`
    case 'upload/media':
      return `uploadIntent actor and purpose match media.subAccountId${suffix}`
    case 'notification/activity':
      return `notification.agencyId = actor.agencyId AND optional subAccount.agencyId = actor.agencyId${suffix}`
    case 'team/permission/invitation':
      return `target.agencyId = actor.agencyId AND permission.subAccount.agencyId = actor.agencyId${suffix}`
    case 'billing/commerce/webhook':
      return `provider binding is server-derived and belongs to the resolved agency/subaccount${suffix}`
    case 'contact':
      return `contact.subAccountId = resolved subAccount.id${suffix}`
    case 'routing/public':
      return `domain resolves one published funnel and optional published page${suffix}`
    case 'identity/account':
      return `actor.providerSubject = authenticated provider subject${suffix}`
    default:
      return `internal caller supplies a validated bounded contract${suffix}`
  }
}

const denialFor = (disposition: Disposition, effects: Effect[]): Denial => {
  if (disposition === 'PUBLIC_REVIEW_REQUIRED') return 'public unavailable'
  if (disposition === 'DORMANT_BLOCKED') return 'dormant blocked'
  if (effects.some((effect) => ['update', 'delete', 'reorder'].includes(effect))) {
    return 'conflict/stale'
  }
  return 'unauthorized'
}

const concurrencyFor = (effects: Effect[]) => {
  if (effects.includes('no-op boundary')) return 'no state transition'
  if (effects.includes('reorder')) return 'atomic exact-membership batch with stable order'
  if (effects.includes('external call')) return 'server binding plus idempotency key where effectful'
  if (effects.some((effect) => ['update', 'delete', 'composite'].includes(effect))) {
    return 'expected-state conditional write with exact affected count'
  }
  if (effects.includes('create')) return 'unique or idempotent create with collision handling'
  return 'read snapshot; no write authority'
}

export const buildInventoryDraft = (
  root: string,
  immutableParent: string
): InventoryDocument => ({
  version: 1,
  immutableParent,
  records: discoverRepository(root).map((surface) => {
    const domain = domainFor(surface)
    const disposition = dispositionFor(surface, domain)
    const blockedPublicSurface = disposition === 'PUBLIC_REVIEW_REQUIRED'
    const marketingSurface = surface.path.startsWith('src/app/site/')
    const publicSignInSurface = surface.path.includes('/agency/(auth)/sign-')
    const presentationalSurface = [
      'src/app/layout.tsx',
      'src/app/(main)/layout.tsx',
      'src/app/(main)/agency/(auth)/layout.tsx',
      'src/app/(main)/agency/unauthorized/page.tsx',
    ].includes(surface.path)
    const uploadTransport =
      surface.path.startsWith('src/app/api/uploadthing/') ||
      surface.symbol.startsWith('$upload-')
    const uploadNoOp = surface.symbol.startsWith('$upload-callback:')
    const publicLeadSurface =
      surface.symbol === 'submitPublicLead' ||
      surface.symbol === 'createPublicLeadService' ||
      surface.symbol === 'publicLeadService'
    const publicSurface = blockedPublicSurface || marketingSurface
    const actorSource = publicSurface
      ? 'anonymous-public contract'
      : disposition === 'DORMANT_BLOCKED' || disposition.startsWith('B5A')
        ? 'blocked'
        : surface.invocation === 'internal-only' || presentationalSurface
          ? 'internal-derived actor'
          : 'provider subject'
    return {
      surfaceId: surface.surfaceId,
      domain,
      path: surface.path,
      symbol: surface.symbol,
      invocation: surface.invocation,
      effects: surface.observedEffects,
      actorSource,
      requestedIds: requestedIdsFor(surface),
      action: actionFor(surface, disposition),
      ownershipPath: uploadNoOp
        ? ['UploadCompletion', 'NoPersistence']
        : publicLeadSurface
          ? ['PublishedFunnel', 'Agency', 'SubAccount', 'Contact']
        : publicSignInSurface
        ? ['AnonymousBrowser', 'ProviderSignIn']
        : presentationalSurface
          ? ['PresentationalBoundary']
          : ownershipFor(domain),
      persistencePredicate: uploadNoOp
        ? 'current callback is a no-op and performs no persistence'
        : publicLeadSurface
          ? 'funnel.id = requestedFunnelId AND funnel.published = true AND contact.subAccountId = funnel.subAccountId'
        : marketingSurface
        ? 'no tenant persistence; optional catalog read is server-configured and bounded'
        : publicSignInSurface
          ? 'no tenant persistence; routing publication requires separate public review'
          : presentationalSurface
            ? 'no tenant persistence or authority decision'
        : b5a2aPersistencePredicates[surface.surfaceId] ??
          persistencePredicateFor(domain, surface.observedEffects),
      denial: marketingSurface || publicSignInSurface
        ? 'public unavailable'
        : presentationalSurface
          ? 'internal invariant failure'
        : denialFor(disposition, surface.observedEffects),
      concurrency: concurrencyFor(surface.observedEffects),
      publicBoundary: blockedPublicSurface
        ? 'BLOCKED_PUBLIC_REVIEW'
        : marketingSurface
          ? 'PUBLIC_MARKETING_SITE'
          : uploadTransport
            ? 'PUBLIC_UPLOADTHING_TRANSPORT'
            : 'PRIVATE',
      disposition,
      sourceHash: surface.sourceHash,
    }
  }),
})

const isOneOf = <T extends readonly string[]>(values: T, value: unknown) =>
  typeof value === 'string' && values.includes(value as T[number])

const validateRecord = (record: InventoryRecord, index: number): string[] => {
  const prefix = `record[${index}]`
  const errors: string[] = []
  const keys = Object.keys(record).sort()
  const expectedKeys = [
    'action',
    'actorSource',
    'concurrency',
    'denial',
    'disposition',
    'domain',
    'effects',
    'invocation',
    'ownershipPath',
    'path',
    'persistencePredicate',
    'publicBoundary',
    'requestedIds',
    'sourceHash',
    'surfaceId',
    'symbol',
  ].sort()
  if (keys.join('|') !== expectedKeys.join('|')) errors.push(`${prefix}:closed-fields`)
  if (
    typeof record.surfaceId !== 'string' ||
    !record.surfaceId ||
    typeof record.path !== 'string' ||
    !/^src\//.test(record.path) ||
    typeof record.symbol !== 'string' ||
    !record.symbol
  ) errors.push(`${prefix}:identity`)
  if (!isOneOf(DOMAINS, record.domain)) errors.push(`${prefix}:domain`)
  if (!isOneOf(INVOCATIONS, record.invocation)) errors.push(`${prefix}:invocation`)
  if (!Array.isArray(record.effects) || record.effects.length === 0 || record.effects.some((value) => !isOneOf(EFFECTS, value))) errors.push(`${prefix}:effects`)
  if (new Set(record.effects).size !== record.effects.length) errors.push(`${prefix}:duplicateEffects`)
  if (!Array.isArray(record.requestedIds) || record.requestedIds.some((value) => typeof value !== 'string' || !value)) errors.push(`${prefix}:requestedIds`)
  if (new Set(record.requestedIds).size !== record.requestedIds.length) errors.push(`${prefix}:duplicateRequestedIds`)
  if (record.requestedIds.join('|') !== [...record.requestedIds].sort().join('|')) errors.push(`${prefix}:requestedIdsOrder`)
  if (!Array.isArray(record.ownershipPath) || record.ownershipPath.length === 0 || record.ownershipPath.some((value) => typeof value !== 'string' || !value)) errors.push(`${prefix}:ownershipPath`)
  if (!isOneOf(ACTOR_SOURCES, record.actorSource)) errors.push(`${prefix}:actorSource`)
  if (
    !isOneOf(ACTIONS, record.action) ||
    typeof record.persistencePredicate !== 'string' ||
    !record.persistencePredicate ||
    typeof record.concurrency !== 'string' ||
    !record.concurrency
  ) errors.push(`${prefix}:contract`)
  if (!isOneOf(DENIALS, record.denial)) errors.push(`${prefix}:denial`)
  if (!isOneOf(DISPOSITIONS, record.disposition)) errors.push(`${prefix}:disposition`)
  if (record.disposition === 'PUBLIC_REVIEW_REQUIRED' && record.publicBoundary !== 'BLOCKED_PUBLIC_REVIEW') errors.push(`${prefix}:publicBoundary`)
  if (!['PRIVATE', 'BLOCKED_PUBLIC_REVIEW', 'PUBLIC_MARKETING_SITE', 'PUBLIC_UPLOADTHING_TRANSPORT'].includes(record.publicBoundary)) errors.push(`${prefix}:publicBoundaryValue`)
  if (record.disposition !== 'PUBLIC_REVIEW_REQUIRED' && record.publicBoundary === 'BLOCKED_PUBLIC_REVIEW') errors.push(`${prefix}:privateBoundary`)
  if (!/^sha256:[a-f0-9]{64}$/.test(record.sourceHash)) errors.push(`${prefix}:sourceHash`)
  if (record.disposition === 'ACCEPTED_RETAIN' && (record.action === 'UNDEFINED_BLOCKED' || record.actorSource === 'blocked')) errors.push(`${prefix}:acceptedBlocked`)
  const dormantActivityFoundation =
    record.surfaceId ===
    'internal-only:src/features/notifications/activity-foundation-service.ts#createActivityFoundationService'
  if (
    (record.disposition.startsWith('B5A') ||
      (record.disposition === 'DORMANT_BLOCKED' && !dormantActivityFoundation)) &&
    (record.action !== 'UNDEFINED_BLOCKED' || record.actorSource !== 'blocked')
  ) errors.push(`${prefix}:remediationAuthority`)
  if (
    dormantActivityFoundation &&
    (record.disposition !== 'DORMANT_BLOCKED' ||
      record.action !== 'INTERNAL_ONLY' ||
      record.actorSource !== 'blocked')
  ) errors.push(`${prefix}:dormantActivityFoundation`)
  if (record.disposition === 'PUBLIC_REVIEW_REQUIRED' && (record.action !== 'PUBLIC_BOUNDED' || record.actorSource !== 'anonymous-public contract')) errors.push(`${prefix}:publicAuthority`)
  return errors
}

export const compareInventory = (
  discovered: DiscoveredSurface[],
  document: InventoryDocument
): string[] => {
  const errors: string[] = []
  const documentKeys = Object.keys(document).sort()
  if (documentKeys.join('|') !== ['immutableParent', 'records', 'version'].join('|')) {
    errors.push('document:closed-fields')
  }
  if (document.version !== 1) errors.push('document:version')
  if (document.immutableParent !== B5A1_IMMUTABLE_PARENT) {
    errors.push('document:parent')
  }
  if (!Array.isArray(document.records)) return [...errors, 'document:records']

  const records = new Map<string, InventoryRecord>()
  if (
    document.records.map((record) => record.surfaceId).join('|') !==
    document.records
      .map((record) => record.surfaceId)
      .sort((left, right) => left.localeCompare(right))
      .join('|')
  ) errors.push('document:record-order')
  document.records.forEach((record, index) => {
    errors.push(...validateRecord(record, index))
    if (records.has(record.surfaceId)) errors.push(`duplicate:${record.surfaceId}`)
    records.set(record.surfaceId, record)
  })

  const discoveredIds = new Set(discovered.map((surface) => surface.surfaceId))
  for (const surface of discovered) {
    const record = records.get(surface.surfaceId)
    if (!record) {
      errors.push(`missing:${surface.surfaceId}`)
      continue
    }
    if (
      record.path !== surface.path ||
      record.symbol !== surface.symbol ||
      record.invocation !== surface.invocation
    ) errors.push(`identity-drift:${surface.surfaceId}`)
    if (record.sourceHash !== surface.sourceHash) errors.push(`hash-drift:${surface.surfaceId}`)
  }
  for (const record of document.records) {
    if (!discoveredIds.has(record.surfaceId)) errors.push(`stale:${record.surfaceId}`)
  }
  return Array.from(new Set(errors)).sort()
}

const stableStringify = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

export const verifyInventoryLock = (
  document: InventoryDocument,
  lock: InventoryLock
): string[] => {
  const errors: string[] = []
  const lockKeys = Object.keys(lock).sort()
  if (
    lockKeys.join('|') !==
    ['immutableParent', 'manifestHash', 'recordCount', 'version'].join('|')
  ) errors.push('lock:closed-fields')
  if (lock.version !== 1) errors.push('lock:version')
  if (
    lock.immutableParent !== B5A1_IMMUTABLE_PARENT ||
    document.immutableParent !== B5A1_IMMUTABLE_PARENT
  ) errors.push('lock:parent')
  if (
    !Number.isSafeInteger(lock.recordCount) ||
    lock.recordCount < 0 ||
    lock.recordCount !== document.records.length
  ) errors.push('lock:recordCount')
  if (!/^sha256:[a-f0-9]{64}$/.test(lock.manifestHash)) {
    errors.push('lock:manifestHashFormat')
  }
  if (lock.manifestHash !== canonicalHash(stableStringify(document))) {
    errors.push('lock:manifestHash')
  }
  return errors
}

export const verifyRepository = (
  rootInput: string,
  documentInput?: InventoryDocument,
  lockInput?: InventoryLock
): VerificationResult => {
  const root = resolve(rootInput)
  const document =
    documentInput ??
    (JSON.parse(
      readFileSync(
        join(root, 'docs/security/agency-authority/inventory.json'),
        'utf8'
      )
    ) as InventoryDocument)
  const lock =
    lockInput ??
    (JSON.parse(
      readFileSync(
        join(root, 'docs/security/agency-authority/inventory.lock.json'),
        'utf8'
      )
    ) as InventoryLock)
  const discovered = discoverRepository(root)
  const sourceByPath = new Map<string, string>()
  for (const surface of discovered) {
    if (!sourceByPath.has(surface.path)) {
      sourceByPath.set(
        surface.path,
        normalizeText(readFileSync(join(root, surface.path), 'utf8'))
      )
    }
  }
  const dbPaths = Array.from(sourceByPath.entries()).filter(([path]) =>
    discovered.some(
      (surface) => surface.path === path && surface.symbol === '$db'
    )
  )
  const useServerFiles = Array.from(sourceByPath.entries()).filter(([, text]) =>
    /^\s*['"]use server['"]/m.test(text)
  )
  const queryExports = discovered.filter(
    (surface) =>
      surface.path === 'src/lib/queries.ts' &&
      surface.invocation === 'server action'
  )
  const apiRoutes = new Set(
    discovered
      .filter((surface) => surface.invocation === 'API handler')
      .map((surface) => surface.path)
  )
  const serverActions = discovered.filter(
    (surface) => surface.invocation === 'server action'
  )
  const loaders = discovered.filter((surface) =>
    surface.invocation.includes('loader')
  )
  const uploadSurfaces = discovered.filter(
    (surface) => surface.invocation === 'upload router/callback'
  )
  return {
    errors: [
      ...compareInventory(discovered, document),
      ...verifyInventoryLock(document, lock),
    ].sort(),
    counts: {
      records: discovered.length,
      databaseImports: dbPaths.length,
      directDatabaseCallers: dbPaths.filter(([path, text]) => {
        const sourceFile = ts.createSourceFile(
          path,
          text,
          ts.ScriptTarget.Latest,
          true,
          path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        )
        return databaseImportLocalNames(sourceFile).some((name) =>
          new RegExp(`\\b${escapeRegex(name)}\\s*\\.`).test(text)
        )
      }).length,
      databaseAdapterInjections: dbPaths.filter(([path, text]) => {
        const sourceFile = ts.createSourceFile(
          path,
          text,
          ts.ScriptTarget.Latest,
          true,
          path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        )
        return !databaseImportLocalNames(sourceFile).some((name) =>
          new RegExp(`\\b${escapeRegex(name)}\\s*\\.`).test(text)
        )
      }).length,
      serverActionFiles: useServerFiles.length,
      serverActionExports: serverActions.length,
      queryExports: queryExports.length,
      apiRouteFiles: apiRoutes.size,
      apiHandlerSymbols: discovered.filter(
        (surface) => surface.invocation === 'API handler'
      ).length,
      pageFiles: loaders.filter((surface) => surface.path.endsWith('/page.tsx'))
        .length,
      layoutFiles: loaders.filter((surface) =>
        surface.path.endsWith('/layout.tsx')
      ).length,
      uploadRoutes: uploadSurfaces.filter((surface) =>
        surface.symbol.startsWith('$upload-route:')
      ).length,
      uploadCallbacks: uploadSurfaces.filter((surface) =>
        surface.symbol.startsWith('$upload-callback:')
      ).length,
      providerBoundaries: discovered.filter(
        (surface) => surface.invocation === 'provider callback'
      ).length,
    },
    manifestHash: canonicalHash(stableStringify(document)),
  }
}

export type OwnershipFixture = {
  actorAgencyId: string | null
  requestedAgencyId: string
  requestedSubaccountId?: string
  resourceAgencyId: string
  resourceSubaccountId?: string
  expectedParentId?: string
  actualParentId?: string
  batchIds?: string[]
  expectedVersion?: number
  actualVersion?: number
  relatedSubaccountIds?: string[]
  batchParentIds?: string[]
  batchMemberExists?: boolean
  expectedOwnershipPath?: string[]
  actualOwnershipPath?: string[]
  expectedAffectedCount?: number
  actualAffectedCount?: number
  expectedUploadPurpose?: string
  actualUploadPurpose?: string
  notificationActorAgencyId?: string
  notificationSubaccountAgencyId?: string
  requestedSideEffects?: number
  duplicateOwnership?: boolean
  missing?: boolean
  orphaned?: boolean
  deleted?: boolean
  revoked?: boolean
  conflicting?: boolean
  malformed?: boolean
  anonymous?: boolean
  publicPublished?: boolean
}

export const evaluateOwnershipFixture = (fixture: OwnershipFixture) => {
  const pathMatches =
    fixture.expectedOwnershipPath === undefined ||
    (fixture.actualOwnershipPath !== undefined &&
      fixture.expectedOwnershipPath.join('|') ===
        fixture.actualOwnershipPath.join('|'))
  let allowed = true
  if (fixture.anonymous) {
    allowed = fixture.publicPublished === true && pathMatches
  } else if (
    fixture.missing ||
    fixture.orphaned ||
    fixture.duplicateOwnership ||
    fixture.deleted ||
    fixture.revoked ||
    fixture.conflicting ||
    fixture.malformed
  ) allowed = false
  else if (!fixture.actorAgencyId) allowed = false
  else if (
    fixture.actorAgencyId !== fixture.requestedAgencyId ||
    fixture.resourceAgencyId !== fixture.requestedAgencyId
  ) allowed = false
  else if (
    fixture.requestedSubaccountId !== undefined &&
    fixture.resourceSubaccountId !== fixture.requestedSubaccountId
  ) allowed = false
  else if (
    fixture.expectedParentId !== undefined &&
    fixture.actualParentId !== fixture.expectedParentId
  ) allowed = false
  else if (
    fixture.expectedVersion !== undefined &&
    fixture.actualVersion !== fixture.expectedVersion
  ) allowed = false
  else if (
    fixture.batchIds &&
    new Set(fixture.batchIds).size !== fixture.batchIds.length
  ) allowed = false
  else if (fixture.batchMemberExists === false) allowed = false
  else if (
    fixture.requestedSubaccountId &&
    fixture.relatedSubaccountIds?.some(
      (subaccountId) => subaccountId !== fixture.requestedSubaccountId
    )
  ) allowed = false
  else if (
    fixture.expectedParentId &&
    fixture.batchParentIds?.some(
      (parentId) => parentId !== fixture.expectedParentId
    )
  ) allowed = false
  else if (!pathMatches) allowed = false
  else if (
    fixture.expectedAffectedCount !== undefined &&
    fixture.actualAffectedCount !== fixture.expectedAffectedCount
  ) allowed = false
  else if (
    fixture.expectedUploadPurpose !== undefined &&
    fixture.actualUploadPurpose !== fixture.expectedUploadPurpose
  ) allowed = false
  else if (
    fixture.notificationActorAgencyId !== undefined &&
    fixture.notificationActorAgencyId !== fixture.requestedAgencyId
  ) allowed = false
  else if (
    fixture.notificationSubaccountAgencyId !== undefined &&
    fixture.notificationSubaccountAgencyId !== fixture.requestedAgencyId
  ) allowed = false

  return {
    allowed,
    pathMatches,
    permittedSideEffects: allowed ? (fixture.requestedSideEffects ?? 1) : 0,
  }
}

export const canonicalDocument = stableStringify
