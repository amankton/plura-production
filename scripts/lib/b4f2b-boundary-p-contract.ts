import { createHash } from 'node:crypto'

export const B4F2B_BOUNDARY_P_GATE =
  'ab10c304d0a94b26ccfa460c6cb2dff8c4fe1f93'

export const B4F2B_MANIFEST_PATH =
  'docs/architecture/CF-P1-B4F2B-boundary-p-manifest.json'
export const B4F2B_SCHEMA_PATH =
  'docs/architecture/schemas/CF-P1-B4F2B-boundary-p.schema.json'
export const B4F2B_AUTHORIZATION_TEMPLATE_PATH =
  'docs/templates/CF-P1-B4F2B-boundary-r-authorization.json'
export const B4F2B_EVIDENCE_TEMPLATE_PATH =
  'docs/templates/CF-P1-B4F2B-boundary-r-evidence.json'
export const B4F2B_INVENTORY_PATH =
  'docs/evidence/CF-P1-B4F2B-boundary-p-inventory.json'

export const B4F2B_OFFLINE_SOURCE_PATHS = [
  'prisma/schema.prisma',
  'docs/architecture/ADR-0001-permission-user-id-migration.md',
  'docs/execution/sql/CF-P1-B4D-logical-subscription-plan-expand.sql',
  'docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql',
  'scripts/permission-migration-preflight.ts',
  'scripts/subscription-plan-migration-preflight.ts',
] as const

export const B4F2B_PROTECTED_SURFACE_PATHS = [
  '.env.example',
  'bun.lockb',
  'package.json',
  'prisma/schema.prisma',
  'src/app/api/stripe/webhook/route.ts',
  'src/lib/stripe/prisma-webhook-processing-store-core.ts',
  'src/lib/stripe/webhook-processor.ts',
  'src/lib/stripe/webhook-worker.ts',
  'src/middleware.ts',
  'docs/execution/sql/CF-P1-B4D-logical-subscription-plan-expand.sql',
  'docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql',
] as const

export const B4F2B_CONTRACT_PATHS = [
  B4F2B_MANIFEST_PATH,
  B4F2B_SCHEMA_PATH,
  B4F2B_AUTHORIZATION_TEMPLATE_PATH,
  B4F2B_EVIDENCE_TEMPLATE_PATH,
] as const

export const B4F2B_FORBIDDEN_ENVIRONMENT_KEYS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'DOCKER_CERT_PATH',
  'DOCKER_CONTEXT',
  'DOCKER_HOST',
  'DOCKER_TLS_VERIFY',
  'MYSQL_HOST',
  'MYSQL_PWD',
  'MYSQL_TCP_PORT',
  'PLANETSCALE_SERVICE_TOKEN',
] as const

type BoundaryPOfflineSourcePath =
  (typeof B4F2B_OFFLINE_SOURCE_PATHS)[number]
type ProtectedSurfacePath = (typeof B4F2B_PROTECTED_SURFACE_PATHS)[number]
type ContractPath = (typeof B4F2B_CONTRACT_PATHS)[number]
type SourceMap = Record<BoundaryPOfflineSourcePath, string>
type BinaryMap = Record<ProtectedSurfacePath, Uint8Array>
type ContractDocumentMap = Record<ContractPath, string>
type JsonRecord = Record<string, unknown>

const expectedContractHashes: Record<ContractPath, string> = {
  'docs/architecture/CF-P1-B4F2B-boundary-p-manifest.json':
    '6f7cf321bdd9706065549d6889fee4ce9e6dbb091df36398924708d1b9495855',
  'docs/architecture/schemas/CF-P1-B4F2B-boundary-p.schema.json':
    'ca44a93606eba430a3b19a78e24669942367e81cdfbc7cf6f69787d6c607f804',
  'docs/templates/CF-P1-B4F2B-boundary-r-authorization.json':
    'c06999c748cb71918b72e53fb3bc5e7af9016a2845b9f04f7f9e8295b60f3134',
  'docs/templates/CF-P1-B4F2B-boundary-r-evidence.json':
    '6cc24d5114e054cdd1a4514f9ac8a1aca4dc5854f7285c21ea003aab4aa7d5b0',
}

const expectedSourceHashes: Record<BoundaryPOfflineSourcePath, string> = {
  'prisma/schema.prisma':
    '69ec7ba100cdb0d1907d3ba62d71a0fab206a837a24e13e09bb5cd6dabc535cb',
  'docs/architecture/ADR-0001-permission-user-id-migration.md':
    'c471605698cc231ec1cd3f082abdc699a573e11a237634a343d8fd28b242ef9b',
  'docs/execution/sql/CF-P1-B4D-logical-subscription-plan-expand.sql':
    '986397f506dcf9f9d1d163ddda6e403abdcec98da3edfb5dc172a2f279eb6fe7',
  'docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql':
    '66195477220c545cc75efad4d269443ff0cc0492e2631e6a113cbee6f0f9621d',
  'scripts/permission-migration-preflight.ts':
    '3034e93e9821845fe80fef03dfdd6c159499464ffa339665a213a229150e471c',
  'scripts/subscription-plan-migration-preflight.ts':
    '77170a6c3ea09d3d7d5545bf666cbab29cd862b5d2888f11e6c3dea675a374f6',
}

const expectedProtectedBlobs: Record<ProtectedSurfacePath, string> = {
  '.env.example': '13e848789d6a6be3e22324db547f4fdfc7c6d618',
  'bun.lockb': '9fd7455e517b55bd2cc77a882cc4468f0eebb526',
  'package.json': 'c8a1a9d11f484792d9d2ffee9d5c728144841105',
  'prisma/schema.prisma': '68cc70de4c0e3d3d18fa29c00869d256c3230700',
  'src/app/api/stripe/webhook/route.ts':
    'bec844221982137ccc085b804d5906e36283eca5',
  'src/lib/stripe/prisma-webhook-processing-store-core.ts':
    'b5c19ef83a2e7d4a3f3add1f4895ba07feb4652b',
  'src/lib/stripe/webhook-processor.ts':
    'b3d898f18b62b7ec0abf34646da10a6214b1231d',
  'src/lib/stripe/webhook-worker.ts':
    '173e58f9bc14ff56a497e030ec77a9458ef03a25',
  'src/middleware.ts': '2d619a87849a6749937b3472702d0ae1455a8e99',
  'docs/execution/sql/CF-P1-B4D-logical-subscription-plan-expand.sql':
    '4b476bd2ca5d16e5e978cefdd7ed43640e1076a1',
  'docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql':
    '6b20010ab8b9a1c1072ab79b16b8f5cd87f98838',
}

const requiredMarkers: Record<BoundaryPOfflineSourcePath, readonly string[]> = {
  'docs/architecture/ADR-0001-permission-user-id-migration.md': [
    'Use an expand-and-contract migration',
    'Run the read-only preflight',
    'No destructive step may run',
  ],
  'docs/execution/sql/CF-P1-B4D-logical-subscription-plan-expand.sql': [
    'Staging draft only',
    'ALTER TABLE `Subscription`',
    "ADD COLUMN `logicalPlan` ENUM('BASIC', 'UNLIMITED') NULL",
  ],
  'docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql': [
    'disposable-development compatibility draft only',
    'CREATE TABLE IF NOT EXISTS `StripeWebhookReceipt`',
    'CREATE TABLE IF NOT EXISTS `StripeWebhookObjectLease`',
    'CREATE TABLE IF NOT EXISTS `StripeWebhookReplayAudit`',
  ],
  'prisma/schema.prisma': [
    'provider     = "mysql"',
    'relationMode = "prisma"',
    'model Permissions',
    'model StripeWebhookReceipt',
    'model StripeWebhookObjectLease',
    'model StripeWebhookReplayAudit',
    'logicalPlan Plan?',
  ],
  'scripts/permission-migration-preflight.ts': [
    "import { db } from '../src/lib/db'",
    'analyzePermissionMigration',
  ],
  'scripts/subscription-plan-migration-preflight.ts': [
    "import { db } from '../src/lib/db'",
    'analyzeSubscriptionPlanMigration',
  ],
}

const stageIds = [
  'P0_REPOSITORY_BASELINE',
  'P1_PERMISSION_CHARACTERIZATION_PLAN',
  'P2_PERMISSION_EXPAND_PLAN',
  'P3_PERMISSION_BACKFILL_UNIQUENESS_PLAN',
  'P4_SUBSCRIPTION_CHARACTERIZATION_PLAN',
  'P5_LOGICAL_PLAN_SYNTHETIC_EXPAND',
  'P6_LOGICAL_PLAN_BACKFILL_PLAN',
  'P7_WEBHOOK_STRUCTURAL_PREFLIGHT',
  'P8_WEBHOOK_SYNTHETIC_EXPAND',
  'P9_COMPATIBILITY_PLAN',
  'P10_FAILURE_RERESTORE_PLAN',
  'P11_CLEANUP_PLAN',
] as const

const normalize = (value: string) =>
  `${value.replace(/\r\n/g, '\n').trimEnd()}\n`

export const sha256 = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex')

export const gitBlobSha1 = (value: Uint8Array) => {
  const header = new TextEncoder().encode(`blob ${value.byteLength}\0`)
  return createHash('sha1').update(header).update(value).digest('hex')
}

const protectedSurfaceBlobSha1 = (
  surfacePath: ProtectedSurfacePath,
  value: Uint8Array
) => {
  if (surfacePath === 'bun.lockb') return gitBlobSha1(value)
  const normalized = new TextEncoder().encode(
    new TextDecoder('utf-8', { fatal: true }).decode(value).replace(/\r\n/g, '\n')
  )
  return gitBlobSha1(normalized)
}

const record = (value: unknown, label: string): JsonRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as JsonRecord
}

const exactKeys = (
  value: JsonRecord,
  expected: readonly string[],
  label: string
) => {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} has an open or incomplete shape`)
  }
}

const stringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${label} must be a string array`)
  }
  return value
}

const assertSha256OrNull = (value: unknown, label: string) => {
  if (value !== null && (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))) {
    throw new Error(`${label} is not a bounded SHA-256 value`)
  }
}

const assertSourceSet = (sources: SourceMap) => {
  exactKeys(sources, B4F2B_OFFLINE_SOURCE_PATHS, 'source inventory')
  for (const sourcePath of B4F2B_OFFLINE_SOURCE_PATHS) {
    const normalized = normalize(sources[sourcePath])
    if (sha256(normalized) !== expectedSourceHashes[sourcePath]) {
      throw new Error(`source drift detected for ${sourcePath}`)
    }
    for (const marker of requiredMarkers[sourcePath]) {
      if (!normalized.includes(marker)) {
        throw new Error(`required source marker missing for ${sourcePath}`)
      }
    }
    if (sourcePath.endsWith('.sql')) {
      const statements = normalized
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
      if (/\b(DROP|TRUNCATE|DELETE|UPDATE|INSERT|RENAME|REPLACE)\b/i.test(statements)) {
        throw new Error(`non-expand SQL detected for ${sourcePath}`)
      }
    }
  }
}

const assertContractDocumentSet = (documents: ContractDocumentMap) => {
  exactKeys(documents, B4F2B_CONTRACT_PATHS, 'contract documents')
  for (const contractPath of B4F2B_CONTRACT_PATHS) {
    if (sha256(normalize(documents[contractPath])) !== expectedContractHashes[contractPath]) {
      throw new Error(`contract document drift detected for ${contractPath}`)
    }
  }
}

const assertProtectedSet = (surfaces: BinaryMap) => {
  exactKeys(surfaces, B4F2B_PROTECTED_SURFACE_PATHS, 'protected surfaces')
  for (const surfacePath of B4F2B_PROTECTED_SURFACE_PATHS) {
    if (
      protectedSurfaceBlobSha1(surfacePath, surfaces[surfacePath]) !==
      expectedProtectedBlobs[surfacePath]
    ) {
      throw new Error(`protected surface drift detected for ${surfacePath}`)
    }
  }
}

export const validateClosedSchemaDocument = (value: unknown) => {
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (!node || typeof node !== 'object') return
    const current = node as JsonRecord
    if (current.type === 'object') {
      if (current.additionalProperties !== false) {
        throw new Error('every object schema must reject additional properties')
      }
      const properties = record(current.properties, 'schema properties')
      const required = stringArray(current.required, 'schema required keys').sort()
      if (JSON.stringify(required) !== JSON.stringify(Object.keys(properties).sort())) {
        throw new Error('every object schema must require every declared property')
      }
    }
    Object.values(current).forEach(visit)
  }
  const schema = record(value, 'closed schema')
  exactKeys(schema, ['format', 'oneOf', '$defs'], 'closed schema')
  if (schema.format !== 'Crewframe B4F2B closed contract schema v1') {
    throw new Error('closed schema format is invalid')
  }
  visit(schema)
}

export const authorizationState = (
  value: unknown
): 'INVALID' | 'INCOMPLETE' | 'COMPLETE_AWAITING_EXTERNAL_APPROVAL' => {
  try {
    const packet = record(value, 'authorization packet')
    exactKeys(
      packet,
      ['format', 'gateSha', 'boundary', 'state', 'scope', 'approvals', 'rules'],
      'authorization packet'
    )
    if (
      packet.format !== 'Crewframe B4F2B Boundary R authorization v1' ||
      packet.gateSha !== B4F2B_BOUNDARY_P_GATE ||
      packet.boundary !== 'R' ||
      !['INCOMPLETE', 'COMPLETE_AWAITING_EXTERNAL_APPROVAL'].includes(
        String(packet.state)
      )
    ) {
      return 'INVALID'
    }
    const scope = record(packet.scope, 'authorization scope')
    exactKeys(
      scope,
      [
        'sourceFingerprintSha256',
        'targetFingerprintSha256',
        'operations',
        'windowStartUtc',
        'windowEndUtc',
        'backupMetadataSha256',
        'retentionPolicySha256',
        'rollbackPlanSha256',
      ],
      'authorization scope'
    )
    const approvals = record(packet.approvals, 'authorization approvals')
    exactKeys(
      approvals,
      [
        'humanOperatorApprovalSha256',
        'databaseOwnerApprovalSha256',
        'dataSecurityOwnerApprovalSha256',
        'architectApprovalSha256',
        'verifierApprovalSha256',
        'acceptanceApprovalSha256',
      ],
      'authorization approvals'
    )
    const rules = record(packet.rules, 'authorization rules')
    exactKeys(
      rules,
      [
        'sourceReadOnly',
        'targetIsolated',
        'targetNonRoutable',
        'applicationDisconnected',
        'separateLeastPrivilegeRoles',
      ],
      'authorization rules'
    )
    for (const [key, item] of Object.entries(scope)) {
      if (key.endsWith('Sha256')) assertSha256OrNull(item, key)
    }
    for (const [key, item] of Object.entries(approvals)) {
      assertSha256OrNull(item, key)
    }
    const operations = stringArray(scope.operations, 'authorization operations')
    const allowedOperations = new Set([
      'READ_ONLY_STRUCTURAL_FINGERPRINT',
      'OWNER_APPROVED_BACKUP_METADATA_READ',
      'ISOLATED_TARGET_RESTORE',
      'ISOLATED_TARGET_PREFLIGHT',
      'ISOLATED_TARGET_EXPAND_REHEARSAL',
      'ISOLATED_TARGET_FAILURE_INJECTION',
      'ISOLATED_TARGET_CLEANUP',
    ])
    if (operations.some((operation) => !allowedOperations.has(operation))) {
      return 'INVALID'
    }
    if (!Object.values(rules).every((item) => typeof item === 'boolean')) {
      return 'INVALID'
    }
    const windowStart = scope.windowStartUtc
    const windowEnd = scope.windowEndUtc
    const isUtcDate = (item: unknown) =>
      typeof item === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(item) &&
      !Number.isNaN(Date.parse(item))
    if (
      (windowStart !== null && !isUtcDate(windowStart)) ||
      (windowEnd !== null && !isUtcDate(windowEnd)) ||
      (isUtcDate(windowStart) &&
        isUtcDate(windowEnd) &&
        Date.parse(windowStart as string) >= Date.parse(windowEnd as string))
    ) {
      return 'INVALID'
    }
    const scalarScopeComplete = Object.entries(scope)
      .filter(([key]) => key !== 'operations')
      .every(([, item]) => item !== null)
    const complete =
      operations.length > 0 &&
      scalarScopeComplete &&
      Object.values(approvals).every((item) => item !== null) &&
      Object.values(rules).every((item) => item === true)
    const derivedState = complete
      ? 'COMPLETE_AWAITING_EXTERNAL_APPROVAL'
      : 'INCOMPLETE'
    return packet.state === derivedState ? derivedState : 'INVALID'
  } catch {
    return 'INVALID'
  }
}

export const validateAuthorizationTemplate = (value: unknown) => {
  if (authorizationState(value) !== 'INCOMPLETE') {
    throw new Error('authorization template is invalid')
  }
  const packet = value as JsonRecord
  const scope = packet.scope as JsonRecord
  const approvals = packet.approvals as JsonRecord
  const rules = packet.rules as JsonRecord
  if (
    packet.state !== 'INCOMPLETE' ||
    !Array.isArray(scope.operations) ||
    scope.operations.length !== 0 ||
    Object.entries(scope).some(
      ([key, item]) => key !== 'operations' && item !== null
    ) ||
    Object.values(approvals).some((item) => item !== null) ||
    Object.values(rules).some((item) => item !== false)
  ) {
    throw new Error('authorization template must be completely blank')
  }
}

export const validateEvidenceTemplate = (value: unknown) => {
  const template = record(value, 'evidence template')
  exactKeys(
    template,
    [
      'format',
      'gateSha',
      'boundary',
      'outcome',
      'runFingerprintSha256',
      'sourceFingerprintSha256',
      'targetFingerprintSha256',
      'records',
      'policy',
    ],
    'evidence template'
  )
  if (
    template.format !== 'Crewframe B4F2B Boundary R evidence v1' ||
    template.gateSha !== B4F2B_BOUNDARY_P_GATE ||
    template.boundary !== 'R' ||
    template.outcome !== 'NOT_RUN' ||
    !Array.isArray(template.records) ||
    template.records.length !== 0
  ) {
    throw new Error('evidence template is not a non-executable blank template')
  }
  for (const key of [
    'runFingerprintSha256',
    'sourceFingerprintSha256',
    'targetFingerprintSha256',
  ]) {
    if (template[key] !== null) throw new Error('evidence fingerprint must be blank')
  }
  const policy = record(template.policy, 'evidence policy')
  exactKeys(policy, ['allowed', 'forbidden', 'stableIdentifiers'], 'evidence policy')
  const expectedAllowed = [
    'BOUNDED_AGGREGATE_COUNT',
    'DURATION_MILLISECONDS',
    'EXIT_STATE',
    'SHA256_FINGERPRINT',
    'STRUCTURAL_CATEGORY',
  ]
  const expectedForbidden = [
    'CONNECTION_STRING',
    'CREDENTIAL',
    'EMAIL',
    'HOST',
    'PATH',
    'PROVIDER_IDENTIFIER',
    'RECORD_IDENTIFIER',
    'REPRESENTATIVE_ROW',
    'SECRET',
    'TENANT_IDENTIFIER',
    'URL',
    'USER_CONTENT',
  ]
  if (
    JSON.stringify(policy.allowed) !== JSON.stringify(expectedAllowed) ||
    JSON.stringify(policy.forbidden) !== JSON.stringify(expectedForbidden) ||
    policy.stableIdentifiers !== false
  ) {
    throw new Error('stable evidence identifiers are forbidden')
  }
  const serialized = JSON.stringify(template)
  for (const forbiddenKey of [
    'command',
    'credential',
    'email',
    'host',
    'message',
    'path',
    'providerId',
    'recordId',
    'row',
    'secret',
    'tenantId',
    'url',
  ]) {
    if (
      new RegExp(`"${forbiddenKey}"\\s*:`, 'i').test(serialized)
    ) {
      throw new Error('evidence template contains a forbidden field')
    }
  }
}

export const validateManifest = (value: unknown) => {
  const manifest = record(value, 'manifest')
  exactKeys(
    manifest,
    [
      'format',
      'gateSha',
      'status',
      'boundaries',
      'inputPolicy',
      'blockedActions',
      'sourceArtifacts',
      'protectedSurfaces',
      'stageGraph',
      'criterionDisposition',
      'validationStates',
      'stopCodes',
    ],
    'manifest'
  )
  if (
    manifest.format !== 'Crewframe B4F2B Boundary P manifest v1' ||
    manifest.gateSha !== B4F2B_BOUNDARY_P_GATE ||
    manifest.status !== 'BOUNDARY_P_CONTRACT_ONLY'
  ) {
    throw new Error('manifest identity is invalid')
  }
  const boundaries = record(manifest.boundaries, 'manifest boundaries')
  exactKeys(boundaries, ['P', 'R'], 'manifest boundaries')
  if (boundaries.P !== 'ALLOWED_OFFLINE_SYNTHETIC_ONLY' || boundaries.R !== 'BLOCKED') {
    throw new Error('manifest boundary state is invalid')
  }
  const inputPolicy = record(manifest.inputPolicy, 'manifest input policy')
  exactKeys(
    inputPolicy,
    [
      'acceptsArguments',
      'acceptsCredentials',
      'acceptsEnvironmentConfiguration',
      'acceptsRepresentativeMetadata',
      'acceptsUrls',
      'fixedRepositoryFilesOnly',
    ],
    'manifest input policy'
  )
  if (
    inputPolicy.acceptsArguments !== false ||
    inputPolicy.acceptsCredentials !== false ||
    inputPolicy.acceptsEnvironmentConfiguration !== false ||
    inputPolicy.acceptsRepresentativeMetadata !== false ||
    inputPolicy.acceptsUrls !== false ||
    inputPolicy.fixedRepositoryFilesOnly !== true
  ) {
    throw new Error('manifest input policy is not fail closed')
  }
  const blockedActions = stringArray(manifest.blockedActions, 'blocked actions')
  const expectedBlockedActions = [
    'CREDENTIAL_ACCESS',
    'CONNECTION_STRING_INPUT',
    'NETWORK_ACCESS',
    'REPRESENTATIVE_METADATA_ACCESS',
    'REPRESENTATIVE_DATABASE_ACCESS',
    'BACKUP_OR_RESTORE',
    'MIGRATION_EXECUTION',
    'APPLICATION_RUNTIME_CONNECTION',
    'PROVIDER_OPERATION',
    'DEPLOYMENT',
    'DESTRUCTIVE_ACTION',
  ]
  if (JSON.stringify(blockedActions) !== JSON.stringify(expectedBlockedActions)) {
    throw new Error('manifest blocked actions are incomplete')
  }
  const sourceArtifacts = Array.isArray(manifest.sourceArtifacts)
    ? manifest.sourceArtifacts
    : []
  if (sourceArtifacts.length !== B4F2B_OFFLINE_SOURCE_PATHS.length) {
    throw new Error('manifest source set is invalid')
  }
  sourceArtifacts.forEach((item, index) => {
    const source = record(item, 'manifest source')
    exactKeys(source, ['path', 'sha256', 'execution'], 'manifest source')
    const path = B4F2B_OFFLINE_SOURCE_PATHS[index]
    if (
      source.path !== path ||
      source.sha256 !== expectedSourceHashes[path] ||
      source.execution !== 'FORBIDDEN'
    ) {
      throw new Error('manifest source fingerprint is invalid')
    }
  })
  const protectedSurfaces = Array.isArray(manifest.protectedSurfaces)
    ? manifest.protectedSurfaces
    : []
  if (protectedSurfaces.length !== B4F2B_PROTECTED_SURFACE_PATHS.length) {
    throw new Error('manifest protected surface set is invalid')
  }
  protectedSurfaces.forEach((item, index) => {
    const surface = record(item, 'manifest protected surface')
    exactKeys(surface, ['path', 'gateBlobSha1'], 'manifest protected surface')
    const path = B4F2B_PROTECTED_SURFACE_PATHS[index]
    if (surface.path !== path || surface.gateBlobSha1 !== expectedProtectedBlobs[path]) {
      throw new Error('manifest protected surface fingerprint is invalid')
    }
  })
  const graph = Array.isArray(manifest.stageGraph) ? manifest.stageGraph : []
  if (graph.length !== stageIds.length) throw new Error('manifest stage graph is incomplete')
  const seen = new Set<string>()
  graph.forEach((item, index) => {
    const stage = record(item, 'manifest stage')
    exactKeys(
      stage,
      [
        'id',
        'title',
        'boundary',
        'dependencies',
        'planStatus',
        'executionStatus',
        'mutation',
        'sqlSource',
        'rollback',
        'lockRisk',
        'invariants',
        'stopCodes',
        'sourceRefs',
      ],
      'manifest stage'
    )
    if (stage.id !== stageIds[index] || stage.boundary !== 'P') {
      throw new Error('manifest stage identity is invalid')
    }
    const dependencies = stringArray(stage.dependencies, 'stage dependencies')
    if (dependencies.some((dependency) => !seen.has(dependency))) {
      throw new Error('manifest graph is cyclic or references a future stage')
    }
    seen.add(String(stage.id))
    if (stage.planStatus !== 'PLAN_VALIDATED') {
      throw new Error('manifest plan has an invalid status')
    }
    const expectedExecution = [
      'P5_LOGICAL_PLAN_SYNTHETIC_EXPAND',
      'P8_WEBHOOK_SYNTHETIC_EXPAND',
    ].includes(String(stage.id))
      ? 'SYNTHETIC_ONLY'
      : 'BLOCKED_BOUNDARY_R'
    if (stage.executionStatus !== expectedExecution) {
      throw new Error('manifest execution disposition is invalid')
    }
    const syntheticSqlByStage: Record<string, string> = {
      P5_LOGICAL_PLAN_SYNTHETIC_EXPAND:
        'docs/execution/sql/CF-P1-B4D-logical-subscription-plan-expand.sql',
      P8_WEBHOOK_SYNTHETIC_EXPAND:
        'docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql',
    }
    const expectedSql = syntheticSqlByStage[String(stage.id)] ?? null
    if (stage.sqlSource !== expectedSql) {
      throw new Error('manifest SQL boundary is invalid')
    }
    const designRequired = [
      'P2_PERMISSION_EXPAND_PLAN',
      'P3_PERMISSION_BACKFILL_UNIQUENESS_PLAN',
      'P6_LOGICAL_PLAN_BACKFILL_PLAN',
    ].includes(String(stage.id))
    const expectedMutation = expectedSql
      ? 'DISPOSABLE_SYNTHETIC_ONLY'
      : designRequired
        ? 'DESIGN_REQUIRED'
        : 'NONE'
    if (stage.mutation !== expectedMutation) {
      throw new Error('manifest mutation boundary is invalid')
    }
    if (
      typeof stage.rollback !== 'string' ||
      typeof stage.lockRisk !== 'string' ||
      stringArray(stage.invariants, 'stage invariants').length === 0 ||
      stringArray(stage.stopCodes, 'stage stop codes').length === 0 ||
      stringArray(stage.sourceRefs, 'stage source references').length === 0
    ) {
      throw new Error('manifest stage safety metadata is incomplete')
    }
  })
  const criteria = Array.isArray(manifest.criterionDisposition)
    ? manifest.criterionDisposition
    : []
  if (criteria.length !== 14) throw new Error('manifest criteria are incomplete')
  const allowedDispositions = new Set([
    'PLAN_VALIDATED',
    'SYNTHETIC_ONLY',
    'BLOCKED_BOUNDARY_R',
    'NOT_APPLICABLE',
  ])
  criteria.forEach((item, index) => {
    const criterion = record(item, 'manifest criterion')
    exactKeys(criterion, ['id', 'disposition'], 'manifest criterion')
    if (
      criterion.id !== `CF-P1-B4F2B-${String(index + 1).padStart(2, '0')}` ||
      !allowedDispositions.has(String(criterion.disposition))
    ) {
      throw new Error('manifest criterion disposition is invalid')
    }
  })
  if (
    JSON.stringify(manifest.validationStates) !==
    JSON.stringify([
      'INVALID',
      'INCOMPLETE',
      'COMPLETE_AWAITING_EXTERNAL_APPROVAL',
    ])
  ) {
    throw new Error('manifest validation states can imply approval')
  }
  if (
    JSON.stringify(manifest.stopCodes) !==
    JSON.stringify([
      'AMBIENT_CONNECTION_INPUT',
      'AMENDMENT_REQUIRED',
      'BOUNDARY_R_BLOCKED',
      'CONTRACT_INVALID',
      'SOURCE_DRIFT',
      'PROTECTED_SURFACE_DRIFT',
      'UNCLASSIFIED_DRIFT',
      'UNBOUNDED_EVIDENCE',
    ])
  ) {
    throw new Error('manifest stop codes are incomplete')
  }
  const serialized = JSON.stringify(manifest).toUpperCase()
  if (serialized.includes('"PASS"') || serialized.includes('APPROVED_FOR_EXECUTION')) {
    throw new Error('manifest makes an executable or pass claim')
  }
  return manifest
}

export const buildBoundaryPInventory = ({
  sources,
  protectedSurfaces,
  contractDocuments,
  manifest,
  schema,
  authorizationTemplate,
  evidenceTemplate,
}: {
  sources: SourceMap
  protectedSurfaces: BinaryMap
  contractDocuments: ContractDocumentMap
  manifest: unknown
  schema: unknown
  authorizationTemplate: unknown
  evidenceTemplate: unknown
}) => {
  assertSourceSet(sources)
  assertProtectedSet(protectedSurfaces)
  assertContractDocumentSet(contractDocuments)
  validateClosedSchemaDocument(schema)
  validateEvidenceTemplate(evidenceTemplate)
  const manifestRecord = validateManifest(manifest)
  validateAuthorizationTemplate(authorizationTemplate)
  const prisma = sources['prisma/schema.prisma']
  const permissionModel = prisma.match(/model Permissions \{([\s\S]*?)\n\}/)?.[1]
  if (!permissionModel) throw new Error('Permissions model could not be isolated')
  return {
    format: 'Crewframe B4F2B Boundary P offline inventory v1',
    gateSha: B4F2B_BOUNDARY_P_GATE,
    boundaryP: 'CONTRACT_VALIDATED_SYNTHETIC_NOT_RUN',
    boundaryR: 'BLOCKED',
    authorizationState: 'INCOMPLETE',
    representativeState: 'NOT_ACCESSED',
    currentState: {
      migrationBaseline: 'ABSENT_REQUIRES_AUTHORIZED_BASELINE',
      prismaProvider: 'mysql',
      prismaRelationMode: 'prisma',
      permissionUserIdInPrisma: /\buserId\b/.test(permissionModel),
      prismaDeclaresLogicalPlan: /\blogicalPlan\s+Plan\?/.test(prisma),
      prismaDeclaresWebhookInbox:
        /model StripeWebhookReceipt/.test(prisma) &&
        /model StripeWebhookObjectLease/.test(prisma) &&
        /model StripeWebhookReplayAudit/.test(prisma),
    },
    sourceArtifacts: B4F2B_OFFLINE_SOURCE_PATHS.map((path) => ({
      path,
      sha256: sha256(normalize(sources[path])),
    })),
    contractArtifacts: B4F2B_CONTRACT_PATHS.map((path) => ({
      path,
      sha256: sha256(normalize(contractDocuments[path])),
    })),
    protectedSurfaces: B4F2B_PROTECTED_SURFACE_PATHS.map((path) => ({
      path,
      gateBlobSha1: protectedSurfaceBlobSha1(path, protectedSurfaces[path]),
    })),
    stageGraph: manifestRecord.stageGraph as JsonRecord[],
    criterionDisposition: manifestRecord.criterionDisposition as JsonRecord[],
  } as const
}

export type {
  BinaryMap,
  BoundaryPOfflineSourcePath,
  ContractDocumentMap,
  ContractPath,
  ProtectedSurfacePath,
  SourceMap,
}
