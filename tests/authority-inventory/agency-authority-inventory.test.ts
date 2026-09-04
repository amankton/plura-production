import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  ACTIONS,
  ACTOR_SOURCES,
  B5A1_IMMUTABLE_PARENT,
  buildInventoryDraft,
  canonicalDocument,
  compareInventory,
  DENIALS,
  discoverRepository,
  DISPOSITIONS,
  DOMAINS,
  EFFECTS,
  evaluateOwnershipFixture,
  INVOCATIONS,
  type InventoryDocument,
  type InventoryLock,
  type OwnershipFixture,
  verifyInventoryLock,
  verifyRepository,
} from '../../scripts/agency-authority-inventory-lib'

const temporaryDirectories: string[] = []

afterEach(() => {
  while (temporaryDirectories.length) {
    rmSync(temporaryDirectories.pop()!, { force: true, recursive: true })
  }
})

const makeFixtureRepository = () => {
  const root = mkdtempSync(join(tmpdir(), 'crewframe-b5a1-'))
  temporaryDirectories.push(root)
  const files: Record<string, string> = {
    'src/lib/example.ts': [
      "'use server'",
      "import { db } from '@/lib/db'",
      'export const findExample = async (exampleId: string) =>',
      '  db.example.findUnique({ where: { id: exampleId } })',
      '',
    ].join('\n'),
    'src/app/api/example/route.ts': [
      'export async function POST(request: Request) {',
      '  return Response.json({ ok: Boolean(request) })',
      '}',
      '',
    ].join('\n'),
    'src/app/(main)/agency/[agencyId]/page.tsx': [
      'const Page = async ({ params }: { params: { agencyId: string } }) =>',
      '  params.agencyId',
      'export default Page',
      '',
    ].join('\n'),
    'src/app/api/uploadthing/core.ts': [
      'const f = (value: unknown) => ({',
      '  middleware: () => ({ onUploadComplete: () => value }),',
      '})',
      'type FileRouter = object',
      'export const ourFileRouter = {',
      "  media: f({ image: { maxFileSize: '4MB' } })",
      '} satisfies FileRouter',
      '',
    ].join('\n'),
    'src/lib/aliased-database.ts': [
      "import { db as prisma } from '@/lib/db'",
      'export const findAliased = (recordId: string) =>',
      '  prisma.record.findUnique({ where: { id: recordId } })',
      '',
    ].join('\n'),
    'src/lib/provider.ts': [
      "import { getStripeServerClient } from '@/lib/stripe'",
      'export const readAccount = (accountId: string) =>',
      '  getStripeServerClient().accounts.retrieve(accountId)',
      '',
    ].join('\n'),
    'src/lib/auth/clerk-adapters.ts': [
      'export const createClerkIdentityProvider = (getAuth: () => Promise<any>) =>',
      '  async () => getAuth()',
      'export const createClerkProfileProvider = (getCurrentUser: () => Promise<any>) =>',
      '  async () => getCurrentUser()',
      'export const invite = async (values: { getClient: () => Promise<any> }) => {',
      '  const sdk = await values.getClient()',
      "  await sdk.invitations.createInvitation({ emailAddress: 'fixture' })",
      '  await sdk.invitations.revokeInvitation("invitation")',
      '}',
      '',
    ].join('\n'),
    'src/lib/stripe/webhook-intake.ts': [
      'export const createStripeSdkWebhookVerifier = (webhooks: any) => (body: Buffer) =>',
      "  webhooks.constructEvent(body, 'signature', 'secret')",
      '',
    ].join('\n'),
    'src/lib/stripe/webhook-processor.ts': [
      'export const processStripeWebhookReceipt = async (dependencies: any) => {',
      "  await dependencies.provider.retrieveSubscription({ subscriptionId: 'stored' })",
      "  return dependencies.provider.retrieveCustomer({ customerId: 'stored' })",
      '}',
      '',
    ].join('\n'),
    'src/lib/aliased-clerk.ts': [
      "import { auth as clerkAuth } from '@clerk/nextjs/server'",
      'export const readAuth = () => clerkAuth()',
      '',
    ].join('\n'),
    'src/lib/clerk-false-positive.ts': [
      "import { currentUser } from '@clerk/nextjs/server'",
      'const auth = () => true',
      'export const localAuth = () => auth()',
      '',
    ].join('\n'),
    'src/components/type-only.tsx': [
      "import type { User } from '@clerk/nextjs/server'",
      'const auth = () => true',
      'export const TypeOnly = ({ user }: { user: User }) => auth() && user.id',
      '',
    ].join('\n'),
  }
  for (const [path, text] of Object.entries(files)) {
    const absolute = join(root, path)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, text)
  }
  return root
}

describe('B5A1 closed agency authority inventory', () => {
  test('reconciles the immutable repository surface and required baseline counts', () => {
    const result = verifyRepository(process.cwd())
    expect(result.errors).toEqual([])
    expect(result.counts).toEqual({
      records: 230,
      databaseImports: 23,
      directDatabaseCallers: 22,
      databaseAdapterInjections: 1,
      serverActionFiles: 4,
      serverActionExports: 53,
      queryExports: 40,
      apiRouteFiles: 5,
      apiHandlerSymbols: 6,
      pageFiles: 24,
      layoutFiles: 7,
      uploadRoutes: 4,
      uploadCallbacks: 4,
      providerBoundaries: 33,
    })
    expect(result.manifestHash).toMatch(/^sha256:[a-f0-9]{64}$/)
    const inventory = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'docs/security/agency-authority/inventory.json'
        ),
        'utf8'
      )
    ) as InventoryDocument
    const providerSymbols = inventory.records
      .filter((record) => record.invocation === 'provider callback')
      .map((record) => record.symbol)
    expect(providerSymbols).toEqual(
      expect.arrayContaining([
        '$provider:stripe.customers.update',
        '$provider:stripe.customers.create',
        '$provider:stripe.customers.retrieve',
        '$provider:stripe.charges.list',
        '$provider:stripe.subscriptions.create',
        '$provider:stripe.subscriptions.retrieve',
        '$provider:stripe.subscriptions.update',
        '$provider:stripe.checkout.sessions.create',
        '$provider:stripe.checkout.sessions.list',
        '$provider:stripe.products.list',
        '$provider:stripe.prices.retrieve',
        '$provider:stripe.prices.list',
        '$provider:clerk.invitations.createInvitation',
        '$provider:clerk.invitations.revokeInvitation',
        '$provider:clerk.auth',
        '$provider:clerk.clerkClient',
        '$provider:clerk.currentUser',
        '$provider:stripe.client',
        '$provider:stripe.webhooks.constructEvent',
        '$provider:stripe.webhooks.constructEventAsync',
      ])
    )
    const dormantProviderRecords = inventory.records.filter(
      (record) =>
        record.path === 'src/lib/stripe/webhook-processor.ts' &&
        record.invocation === 'provider callback'
    )
    expect(dormantProviderRecords.map((record) => record.symbol).sort()).toEqual([
      '$provider:stripe.customers.retrieve',
      '$provider:stripe.subscriptions.retrieve',
    ])
    expect(
      dormantProviderRecords.every(
        (record) => record.disposition === 'DORMANT_BLOCKED'
      )
    ).toBe(true)
    expect(
      inventory.records.find(
        (record) =>
          record.path ===
            'src/app/(main)/agency/[agencyId]/billing/page.tsx' &&
          record.symbol === '$provider:stripe.products.list'
      )?.requestedIds
    ).toEqual(['agencyId', 'serverConfigured.addOnProducts'])
    expect(
      inventory.records.find(
        (record) => record.symbol === 'isCrewframePlan'
      )?.effects
    ).toEqual(['read'])
  })

  test('keeps the JSON schema taxonomies identical to the executable validator', () => {
    const schema = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'docs/security/agency-authority/inventory.schema.json'
        ),
        'utf8'
      )
    )
    const properties = schema.properties.records.items.properties
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual(['version', 'immutableParent', 'records'])
    expect(schema.properties.immutableParent.const).toBe(B5A1_IMMUTABLE_PARENT)
    expect(schema.properties.records.items.additionalProperties).toBe(false)
    expect(schema.properties.records.items.required).toEqual([
      'surfaceId',
      'domain',
      'path',
      'symbol',
      'invocation',
      'effects',
      'actorSource',
      'requestedIds',
      'action',
      'ownershipPath',
      'persistencePredicate',
      'denial',
      'concurrency',
      'publicBoundary',
      'disposition',
      'sourceHash',
    ])
    expect(properties.domain.enum).toEqual([...DOMAINS])
    expect(properties.invocation.enum).toEqual([...INVOCATIONS])
    expect(properties.effects.items.enum).toEqual([...EFFECTS])
    expect(properties.action.enum).toEqual([...ACTIONS])
    expect(properties.actorSource.enum).toEqual([...ACTOR_SOURCES])
    expect(properties.denial.enum).toEqual([...DENIALS])
    expect(properties.disposition.enum).toEqual([...DISPOSITIONS])
  })

  test('discovers server exports, API handlers, loaders, DB composition, and upload boundaries', () => {
    const root = makeFixtureRepository()
    const document = buildInventoryDraft(
      root,
      B5A1_IMMUTABLE_PARENT
    )
    expect(compareInventory(discoverRepository(root), document)).toEqual([])
    const ids = document.records.map((record) => record.surfaceId)
    expect(ids.some((id) => id.endsWith('src/lib/example.ts#findExample'))).toBe(true)
    expect(ids.some((id) => id.endsWith('src/lib/example.ts#$db'))).toBe(true)
    expect(ids.some((id) => id.endsWith('route.ts#POST'))).toBe(true)
    expect(ids.some((id) => id.endsWith('page.tsx#default'))).toBe(true)
    expect(ids.some((id) => id.endsWith('core.ts#$upload-route:media'))).toBe(true)
    expect(ids.some((id) => id.endsWith('core.ts#$upload-callback:media'))).toBe(true)
    expect(ids.some((id) => id.endsWith('aliased-database.ts#$db'))).toBe(true)
    expect(
      ids.some((id) => id.endsWith('provider.ts#$provider:stripe.accounts.retrieve'))
    ).toBe(true)
    expect(
      ids.some((id) =>
        id.endsWith('clerk-adapters.ts#$provider:clerk.invitations.createInvitation')
      )
    ).toBe(true)
    expect(
      ids.some((id) =>
        id.endsWith('clerk-adapters.ts#$provider:clerk.invitations.revokeInvitation')
      )
    ).toBe(true)
    expect(
      ids.some((id) =>
        id.endsWith('webhook-intake.ts#$provider:stripe.webhooks.constructEvent')
      )
    ).toBe(true)
    expect(
      ids.some((id) => id.endsWith('clerk-adapters.ts#$provider:clerk.auth'))
    ).toBe(true)
    expect(
      ids.some((id) => id.endsWith('clerk-adapters.ts#$provider:clerk.currentUser'))
    ).toBe(true)
    expect(
      ids.some((id) => id.endsWith('aliased-clerk.ts#$provider:clerk.auth'))
    ).toBe(true)
    expect(
      ids.some((id) => id.endsWith('webhook-processor.ts#$provider:stripe.subscriptions.retrieve'))
    ).toBe(true)
    expect(
      ids.some((id) => id.endsWith('webhook-processor.ts#$provider:stripe.customers.retrieve'))
    ).toBe(true)
    expect(
      ids.some((id) => id.includes('clerk-false-positive.ts#$provider:'))
    ).toBe(false)
    expect(
      ids.some((id) => id.includes('type-only.tsx#$provider:'))
    ).toBe(false)
    const callback = document.records.find((record) =>
      record.surfaceId.endsWith('core.ts#$upload-callback:media')
    )!
    expect(callback.effects).toEqual(['no-op boundary'])
    expect(callback.requestedIds).toEqual([])
    expect(callback.ownershipPath).toEqual(['UploadCompletion', 'NoPersistence'])
  })

  test('rejects missing, duplicate, newly added, and hash-drifted surfaces', () => {
    const root = makeFixtureRepository()
    const parent = B5A1_IMMUTABLE_PARENT
    const baseline = buildInventoryDraft(root, parent)
    const discovered = discoverRepository(root)

    const missing: InventoryDocument = {
      ...baseline,
      records: baseline.records.slice(1),
    }
    expect(compareInventory(discovered, missing).some((error) => error.startsWith('missing:'))).toBe(true)

    const duplicate: InventoryDocument = {
      ...baseline,
      records: [...baseline.records, baseline.records[0]],
    }
    expect(compareInventory(discovered, duplicate).some((error) => error.startsWith('duplicate:'))).toBe(true)

    const actionPath = join(root, 'src/lib/example.ts')
    writeFileSync(
      actionPath,
      `${readFileSync(actionPath, 'utf8')}export const addedAction = async () => true\n`
    )
    const changed = discoverRepository(root)
    const errors = compareInventory(changed, baseline)
    expect(errors.some((error) => error.includes('addedAction'))).toBe(true)
    expect(errors.some((error) => error.startsWith('hash-drift:'))).toBe(true)
  })

  test('rejects a new provider operation while ignoring type-only provider imports', () => {
    const root = makeFixtureRepository()
    const baseline = buildInventoryDraft(root, B5A1_IMMUTABLE_PARENT)
    const providerPath = join(root, 'src/lib/provider.ts')
    writeFileSync(
      providerPath,
      `${readFileSync(providerPath, 'utf8')}\ngetStripeServerClient().customers.retrieve('customer')\n`
    )
    const changed = discoverRepository(root)
    const errors = compareInventory(changed, baseline)
    expect(
      errors.some((error) =>
        error.includes('$provider:stripe.customers.retrieve')
      )
    ).toBe(true)
    expect(
      changed.some((surface) => surface.path.endsWith('type-only.tsx'))
    ).toBe(false)
  })

  test('locks every semantic field class to the reviewed manifest hash', () => {
    const root = makeFixtureRepository()
    const baseline = buildInventoryDraft(root, B5A1_IMMUTABLE_PARENT)
    const lock: InventoryLock = {
      version: 1,
      immutableParent: B5A1_IMMUTABLE_PARENT,
      recordCount: baseline.records.length,
      manifestHash: `sha256:${createHash('sha256')
        .update(canonicalDocument(baseline))
        .digest('hex')}`,
    }
    expect(verifyInventoryLock(baseline, lock)).toEqual([])

    const mutations: Array<[string, (record: InventoryDocument['records'][number]) => void]> = [
      ['surfaceId', (record) => { record.surfaceId = `${record.surfaceId}:mutated` }],
      ['path', (record) => { record.path = 'src/mutated.ts' }],
      ['symbol', (record) => { record.symbol = `${record.symbol}Mutated` }],
      ['invocation', (record) => { record.invocation = record.invocation === 'internal-only' ? 'server action' : 'internal-only' }],
      ['domain', (record) => { record.domain = record.domain === 'agency' ? 'contact' : 'agency' }],
      ['effects', (record) => { record.effects = record.effects.includes('no-op boundary') ? ['read'] : ['no-op boundary'] }],
      ['actorSource', (record) => { record.actorSource = record.actorSource === 'blocked' ? 'provider subject' : 'blocked' }],
      ['requestedIds', (record) => { record.requestedIds = [...record.requestedIds, 'mutated.selector'].sort() }],
      ['action', (record) => { record.action = record.action === 'INTERNAL_ONLY' ? 'agency:view' : 'INTERNAL_ONLY' }],
      ['ownershipPath', (record) => { record.ownershipPath = [...record.ownershipPath, 'Mutated'] }],
      ['persistencePredicate', (record) => { record.persistencePredicate = `${record.persistencePredicate} AND mutated = true` }],
      ['denial', (record) => { record.denial = record.denial === 'unauthorized' ? 'not found' : 'unauthorized' }],
      ['concurrency', (record) => { record.concurrency = `${record.concurrency}; mutated` }],
      ['publicBoundary', (record) => { record.publicBoundary = record.publicBoundary === 'PRIVATE' ? 'PUBLIC_MARKETING_SITE' : 'PRIVATE' }],
      ['disposition', (record) => { record.disposition = record.disposition === 'B5A2' ? 'B5A3' : 'B5A2' }],
      ['sourceHash', (record) => { record.sourceHash = `sha256:${'0'.repeat(64)}` }],
    ]
    for (const [field, mutate] of mutations) {
      const changed = structuredClone(baseline)
      mutate(changed.records[0])
      expect(
        verifyInventoryLock(changed, lock),
        field
      ).toContain('lock:manifestHash')
    }

    expect(
      compareInventory(discoverRepository(root), {
        ...baseline,
        immutableParent: '0'.repeat(40),
      })
    ).toContain('document:parent')

    expect(
      compareInventory(discoverRepository(root), {
        ...baseline,
        unexpected: true,
      } as InventoryDocument)
    ).toContain('document:closed-fields')
    expect(
      verifyInventoryLock(baseline, {
        ...lock,
        unexpected: true,
      } as InventoryLock)
    ).toContain('lock:closed-fields')
  })

  test('keeps the verifier offline, fixed-input, and free of application runtime imports', () => {
    const verifier = readFileSync(
      join(process.cwd(), 'scripts/verify-agency-authority-inventory.ts'),
      'utf8'
    )
    const library = readFileSync(
      join(process.cwd(), 'scripts/agency-authority-inventory-lib.ts'),
      'utf8'
    )
    expect(`${verifier}\n${library}`).not.toMatch(/process\.env|\bfetch\s*\(|from ['"]@\//)

    const processResult = Bun.spawnSync([
      process.execPath,
      'scripts/verify-agency-authority-inventory.ts',
      'unexpected-argument',
    ])
    expect(processResult.exitCode).toBe(1)
    expect(processResult.stderr.toString()).toBe('B5A1_FAIL argument-count\n')
  })

  test('evaluates synthetic nested ownership and confused-deputy fixtures', () => {
    const fixtures = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'tests/authority-inventory/ownership-fixtures.json'
        ),
        'utf8'
      )
    ) as Array<{ name: string; input: OwnershipFixture; allowed: boolean }>
    const requiredNames = [
      'page belongs to another funnel',
      'lane belongs to another pipeline',
      'ticket lane belongs to another subaccount',
      'ticket contact belongs to another subaccount',
      'ticket assignee belongs to another agency',
      'ticket tag belongs to another subaccount',
      'media purpose mismatch',
      'notification actor agency mismatch',
      'notification subaccount agency mismatch',
      'orphaned nested resource',
      'missing batch member',
      'affected count zero',
      'affected count greater than one',
      'ordered ownership path mismatch',
      'duplicate ownership state',
    ]
    expect(fixtures.length).toBeGreaterThanOrEqual(25)
    expect(fixtures.map((fixture) => fixture.name)).toEqual(
      expect.arrayContaining(requiredNames)
    )
    for (const fixture of fixtures) {
      const result = evaluateOwnershipFixture(fixture.input)
      expect(result.allowed, fixture.name).toBe(fixture.allowed)
      if (!fixture.allowed) {
        expect(result.permittedSideEffects, fixture.name).toBe(0)
      }
    }
  })
})
