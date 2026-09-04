import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { createPrismaWebhookProcessingAdapters } from '../src/lib/stripe/prisma-webhook-processing-store-core'
import type { StripeWebhookReceiptStatus } from '../src/lib/stripe/webhook-inbox-contract'
import {
  processStripeWebhookReceipt,
  type StripeWebhookCustomer,
} from '../src/lib/stripe/webhook-processor'
import type { StripeSubscriptionInput } from '../src/lib/stripe/stripe-normalizers'
import { runStripeWebhookWorkerOnce } from '../src/lib/stripe/webhook-worker'

const scenario = process.argv[2]
if (!['missing', 'outage', 'success'].includes(scenario)) {
  throw new Error('A supported webhook processing-store scenario is required')
}

const now = new Date('2026-09-03T18:00:00.000Z')
const clients: PrismaClient[] = []
const client = new PrismaClient()
clients.push(client)

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message
) => {
  if (!condition) throw new Error(message)
}

const executeNativeMySql = async (sql: string) => {
  const container = process.env.CREWFRAME_MYSQL_CONTAINER
  assert(
    container && /^crewframe-b4f2a2-proof-[a-f0-9]{10}$/.test(container),
    'A validated disposable MySQL container is required for fault injection'
  )
  const child = Bun.spawn(
    [
      'docker',
      'exec',
      '--interactive',
      container,
      'sh',
      '-c',
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --host=127.0.0.1 --user=root crewframe_b4f2a2',
    ],
    {
      stderr: 'pipe',
      stdin: new Blob([sql]),
      stdout: 'pipe',
    }
  )
  const exitCode = await child.exited
  await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  assert(exitCode === 0, 'Native MySQL fault-injection command failed')
}

let eventNumber = 0
const createReceipt = async (
  database: PrismaClient,
  overrides: {
    accountScopeKey?: string
    attempts?: number
    completedAt?: Date | null
    createdAt?: Date
    customerId?: string | null
    eventType?: string
    id?: string
    leaseExpiresAt?: Date | null
    leaseToken?: string | null
    mode?: 'LIVE' | 'TEST'
    nextRetryAt?: Date | null
    status?: StripeWebhookReceiptStatus
    subscriptionId?: string | null
  } = {}
) => {
  eventNumber += 1
  const id = overrides.id ?? randomUUID()
  const createdAt = overrides.createdAt ?? new Date(now.getTime() - eventNumber)
  return database.stripeWebhookReceipt.create({
    data: {
      accountScopeKey: overrides.accountScopeKey ?? 'platform',
      attempts: overrides.attempts ?? 0,
      completedAt: overrides.completedAt ?? null,
      createdAt,
      customerId: overrides.customerId === undefined ? 'cus_agency' : overrides.customerId,
      eventId: `evt_processing${String(eventNumber).padStart(4, '0')}`,
      eventType: overrides.eventType ?? 'customer.subscription.updated',
      id,
      leaseExpiresAt: overrides.leaseExpiresAt ?? null,
      leaseToken: overrides.leaseToken ?? null,
      mode: overrides.mode ?? 'TEST',
      nextRetryAt: overrides.nextRetryAt ?? null,
      objectId: overrides.subscriptionId ?? 'sub_agency',
      payloadHash: String(eventNumber % 10).repeat(64),
      providerCreatedAt: new Date(now.getTime() - 60_000),
      retentionExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      status: overrides.status ?? 'RECEIVED',
      subscriptionId:
        overrides.subscriptionId === undefined
          ? 'sub_agency'
          : overrides.subscriptionId,
    },
  })
}

const clearWebhookState = async () => {
  await client.stripeWebhookObjectLease.deleteMany()
  await client.stripeWebhookReceipt.deleteMany()
  await client.subscription.deleteMany({
    where: { id: { not: 'subscription_legacy' } },
  })
  await client.agency.deleteMany({
    where: { id: { notIn: ['agency_a', 'agency_legacy'] } },
  })
}

const subscriptionSnapshot = (
  id = 'sub_agency',
  customerId = 'cus_agency',
  status = 'active'
): StripeSubscriptionInput => ({
  customer: customerId,
  id,
  items: {
    data: [
      {
        current_period_end: 1_800_000_000,
        id: `si_${id.slice(4)}`,
        price: {
          active: true,
          currency: 'usd',
          id: 'price_basic',
          livemode: false,
          lookup_key: 'crewframe_basic_monthly',
          recurring: {
            interval: 'month',
            interval_count: 1,
            usage_type: 'licensed',
          },
          unit_amount: 4_900,
        },
      },
    ],
  },
  metadata: {},
  object: 'subscription',
  status,
})

const customerSnapshot = (
  id = 'cus_agency',
  agencyId = 'agency_a'
): StripeWebhookCustomer => ({
  id,
  metadata: { crewframeAgencyId: agencyId },
})

const withPrice = (
  subscription: StripeSubscriptionInput,
  price: Partial<
    StripeSubscriptionInput['items']['data'][number]['price']
  >
): StripeSubscriptionInput => {
  const item = subscription.items.data[0]
  return {
    ...subscription,
    items: {
      data: [{ ...item, price: { ...item.price, ...price } }],
    },
  }
}

const expectFailure = async (name: string, operation: () => Promise<unknown>) => {
  let failed = false
  try {
    await operation()
  } catch {
    failed = true
  }
  assert(failed, `${name} did not fail closed`)
}

const verifySelection = async () => {
  await clearWebhookState()
  const adapters = createPrismaWebhookProcessingAdapters(client)
  const retryDue = await createReceipt(client, {
    createdAt: new Date(now.getTime() - 3_600_000),
    nextRetryAt: new Date(now.getTime() - 1_200_000),
    status: 'RETRY_PENDING',
  })
  const processingExpired = await createReceipt(client, {
    createdAt: new Date(now.getTime() - 3_000_000),
    leaseExpiresAt: new Date(now.getTime() - 900_000),
    leaseToken: 'expired',
    status: 'PROCESSING',
  })
  const connected = await createReceipt(client, {
    accountScopeKey: 'connected:acct_synthetic',
    createdAt: new Date(now.getTime() - 800_000),
  })
  const received = await createReceipt(client, {
    createdAt: new Date(now.getTime() - 600_000),
  })
  const tiedHigh = await createReceipt(client, {
    createdAt: new Date(now.getTime() - 400_000),
    id: '10000000-0000-4000-8000-00000000000b',
  })
  const tiedLow = await createReceipt(client, {
    createdAt: new Date(now.getTime() - 400_000),
    id: '10000000-0000-4000-8000-00000000000a',
  })
  const orphaned = await createReceipt(client, {
    createdAt: new Date(now.getTime() - 300_000),
    leaseToken: 'orphaned',
    status: 'PROCESSING',
  })
  const retryEqual = await createReceipt(client, {
    createdAt: new Date(now.getTime() - 200_000),
    nextRetryAt: now,
    status: 'RETRY_PENDING',
  })
  const processingEqual = await createReceipt(client, {
    createdAt: new Date(now.getTime() - 100_000),
    leaseExpiresAt: now,
    leaseToken: 'equal',
    status: 'PROCESSING',
  })
  await createReceipt(client, {
    nextRetryAt: new Date(now.getTime() + 1),
    status: 'RETRY_PENDING',
  })
  await createReceipt(client, {
    leaseExpiresAt: new Date(now.getTime() + 1),
    leaseToken: 'active',
    status: 'PROCESSING',
  })
  await createReceipt(client, { completedAt: now, status: 'SUCCEEDED' })
  await createReceipt(client, { completedAt: now, status: 'IGNORED' })
  await createReceipt(client, { completedAt: now, status: 'DEAD_LETTER' })
  await createReceipt(client, { mode: 'LIVE' })

  const selected = await adapters.dueWork.listDueReceiptIds({ limit: 25, now })
  assert(
    JSON.stringify(selected) ===
      JSON.stringify([
        retryDue.id,
        processingExpired.id,
        connected.id,
        received.id,
        tiedLow.id,
        tiedHigh.id,
        orphaned.id,
        retryEqual.id,
        processingEqual.id,
      ]),
    'Due-work selection or deterministic ordering was incorrect'
  )
  assert(
    (await adapters.dueWork.listDueReceiptIds({ limit: 3, now })).length === 3,
    'Due-work limit was not enforced'
  )
}

const verifyReceiptClaims = async () => {
  await clearWebhookState()
  const target = await createReceipt(client)
  const raceClients = Array.from({ length: 12 }, () => new PrismaClient())
  clients.push(...raceClients)
  let release!: () => void
  const barrier = new Promise<void>((resolve) => {
    release = resolve
  })
  const claims = raceClients.map(async (raceClient, index) => {
    await barrier
    return createPrismaWebhookProcessingAdapters(raceClient).store.claimReceipt({
      leaseToken: `claim-${index}`,
      now,
      receiptId: target.id,
    })
  })
  release()
  const results = await Promise.all(claims)
  assert(results.filter(Boolean).length === 1, 'Receipt claim race had multiple winners')
  const claimed = await client.stripeWebhookReceipt.findUniqueOrThrow({
    where: { id: target.id },
  })
  assert(claimed.attempts === 1, 'Receipt attempts did not increment exactly once')
  assert(
    claimed.leaseExpiresAt?.getTime() === now.getTime() + 60_000,
    'Receipt lease duration was not exactly 60 seconds'
  )
  const oldToken = claimed.leaseToken!
  assert(
    !(await createPrismaWebhookProcessingAdapters(client).store.claimReceipt({
      leaseToken: 'early-reclaim',
      now: new Date(now.getTime() + 59_999),
      receiptId: target.id,
    })),
    'Active receipt lease was stolen before expiry'
  )
  const reclaimAt = new Date(now.getTime() + 60_000)
  const reclaimed = await createPrismaWebhookProcessingAdapters(
    client
  ).store.claimReceipt({
    leaseToken: 'reclaimed-token',
    now: reclaimAt,
    receiptId: target.id,
  })
  assert(reclaimed?.attempts === 2, 'Receipt was not reclaimable at expiry equality')
  assert(
    !(await createPrismaWebhookProcessingAdapters(client).store.completeIgnored({
      now: reclaimAt,
      reasonCode: 'stale_worker',
      receiptId: target.id,
      receiptLeaseToken: oldToken,
    })),
    'Stale receipt token completed reclaimed work'
  )
  assert(
    !(await createPrismaWebhookProcessingAdapters(client).store.completeIgnored({
      now: new Date(reclaimAt.getTime() + 60_000),
      reasonCode: 'expired_worker',
      receiptId: target.id,
      receiptLeaseToken: 'reclaimed-token',
    })),
    'Expired receipt token completed work at expiry equality'
  )

  const exhausted = await createReceipt(client, { attempts: 5 })
  const exhaustedClaim = await createPrismaWebhookProcessingAdapters(
    client
  ).store.claimReceipt({
    leaseToken: 'unused',
    now,
    receiptId: exhausted.id,
  })
  assert(exhaustedClaim === null, 'Attempt-ceiling receipt was returned as claimed')
  assert(
    (await client.stripeWebhookReceipt.findUniqueOrThrow({ where: { id: exhausted.id } }))
      .status === 'DEAD_LETTER',
    'Attempt-ceiling receipt was not durably dead-lettered'
  )
  const processorExhausted = await createReceipt(client, { attempts: 5 })
  let exhaustedProviderCalls = 0
  const exhaustedResult = await processStripeWebhookReceipt(
    processorExhausted.id,
    {
      ...createPrismaWebhookProcessingAdapters(client),
      agencies: {
        findAgenciesByCustomerId: async () => {
          throw new Error('Attempt-ceiling work reached agency lookup')
        },
      },
      now: () => now,
      provider: {
        retrieveCustomer: async () => {
          exhaustedProviderCalls += 1
          throw new Error('Attempt-ceiling work reached Customer retrieval')
        },
        retrieveSubscription: async () => {
          exhaustedProviderCalls += 1
          throw new Error('Attempt-ceiling work reached Subscription retrieval')
        },
      },
      randomToken: randomUUID,
    }
  )
  assert(
    exhaustedResult.disposition === 'dead-letter' && exhaustedProviderCalls === 0,
    'Attempt-ceiling processor performed provider work or missed terminal state'
  )
}

const verifyObjectLeaseClaims = async () => {
  await clearWebhookState()
  const raceClients = Array.from({ length: 12 }, () => new PrismaClient())
  clients.push(...raceClients)
  const key = {
    accountScopeKey: 'platform',
    mode: 'TEST' as const,
    objectId: 'sub_objectrace',
    objectType: 'subscription' as const,
  }
  let release!: () => void
  const barrier = new Promise<void>((resolve) => {
    release = resolve
  })
  const claims = raceClients.map(async (raceClient, index) => {
    await barrier
    return createPrismaWebhookProcessingAdapters(
      raceClient
    ).store.claimObjectLease({ key, leaseToken: `object-${index}`, now })
  })
  release()
  const results = await Promise.all(claims)
  assert(results.filter(Boolean).length === 1, 'Object lease race had multiple winners')
  assert(
    (await client.stripeWebhookObjectLease.count()) === 1,
    'Object lease race persisted multiple rows'
  )
  const first = results.find(Boolean)!
  assert(
    !(await createPrismaWebhookProcessingAdapters(client).store.claimObjectLease({
      key,
      leaseToken: 'object-early-reclaim',
      now: new Date(now.getTime() + 59_999),
    })),
    'Active object lease was stolen before expiry'
  )
  const reclaimAt = new Date(now.getTime() + 60_000)
  const reclaimed = await createPrismaWebhookProcessingAdapters(
    client
  ).store.claimObjectLease({
    key,
    leaseToken: 'object-reclaimed',
    now: reclaimAt,
  })
  assert(reclaimed?.leaseToken === 'object-reclaimed', 'Object lease equality reclaim failed')
  assert(first.leaseToken !== reclaimed.leaseToken, 'Object lease token was not replaced')
}

const verifyRetrySchedule = async () => {
  await clearWebhookState()
  const store = createPrismaWebhookProcessingAdapters(client).store
  for (const [attempt, delay] of [
    [1, 30_000],
    [2, 120_000],
    [3, 600_000],
    [4, 3_600_000],
    [5, null],
  ] as const) {
    const row = await createReceipt(client, { attempts: attempt - 1 })
    const claimed = await store.claimReceipt({
      leaseToken: `retry-${attempt}`,
      now,
      receiptId: row.id,
    })
    assert(claimed?.attempts === attempt, `Attempt ${attempt} did not claim`)
    const failed = await store.failReceipt({
      error: { code: 'provider_timeout', message: 'Provider timed out', retryable: true },
      now: new Date(now.getTime() + 1),
      receiptId: row.id,
      receiptLeaseToken: `retry-${attempt}`,
    })
    assert(failed, `Attempt ${attempt} did not persist failure state`)
    if (delay === null) {
      assert(failed.status === 'DEAD_LETTER', 'Fifth attempt did not dead-letter')
    } else {
      assert(failed.status === 'RETRY_PENDING', `Attempt ${attempt} did not retry`)
      assert(
        failed.nextRetryAt?.getTime() === now.getTime() + 1 + delay,
        `Attempt ${attempt} used the wrong retry delay`
      )
    }
  }
}

const verifyFailureAndObjectRelease = async () => {
  await clearWebhookState()
  const expiredRow = await createReceipt(client, {
    subscriptionId: 'sub_failure_expired',
  })
  const expiredClaim = await claimForProjection(
    expiredRow.id,
    'sub_failure_expired',
    'failure-expired'
  )
  assert(
    !(await expiredClaim.store.failReceipt({
      error: {
        code: 'expired_failure',
        message: 'Expired worker failed',
        retryable: true,
      },
      now: new Date(now.getTime() + 60_000),
      objectLease: expiredClaim.objectLease,
      receiptId: expiredRow.id,
      receiptLeaseToken: expiredClaim.receipt.leaseToken!,
    })),
    'Expired receipt/object ownership persisted a failure'
  )
  assert(
    (
      await client.stripeWebhookReceipt.findUniqueOrThrow({
        where: { id: expiredRow.id },
      })
    ).status === 'PROCESSING' &&
      (await client.stripeWebhookObjectLease.count({
        where: { objectId: 'sub_failure_expired' },
      })) === 1,
    'Expired failure changed receipt or object-lease state'
  )

  const row = await createReceipt(client, {
    subscriptionId: 'sub_failure_release',
  })
  const claim = await claimForProjection(
    row.id,
    'sub_failure_release',
    'failure-release'
  )
  const safeError = {
    code: 'provider_timeout',
    message: 'Provider timed out',
    retryable: true,
  }
  const mismatched = await claim.store.failReceipt({
    error: safeError,
    now: new Date(now.getTime() + 1),
    objectLease: { ...claim.objectLease, objectId: 'sub_unrelated' },
    receiptId: row.id,
    receiptLeaseToken: claim.receipt.leaseToken!,
  })
  assert(mismatched === null, 'Failure transition accepted an unrelated object lease')
  assert(
    (await client.stripeWebhookReceipt.findUniqueOrThrow({ where: { id: row.id } }))
      .status === 'PROCESSING',
    'Mismatched object lease changed the receipt'
  )
  assert(
    (await client.stripeWebhookObjectLease.count({
      where: { objectId: 'sub_failure_release' },
    })) === 1,
    'Mismatched object lease released owned work'
  )

  const failed = await claim.store.failReceipt({
    error: safeError,
    now: new Date(now.getTime() + 2),
    objectLease: claim.objectLease,
    receiptId: row.id,
    receiptLeaseToken: claim.receipt.leaseToken!,
  })
  assert(failed?.status === 'RETRY_PENDING', 'Owned failure did not become retryable')
  assert(
    (await client.stripeWebhookObjectLease.count({
      where: { objectId: 'sub_failure_release' },
    })) === 0,
    'Owned failure did not release the object lease'
  )

  for (const stage of [
    {
      create:
        "CREATE TRIGGER cf_fail_failure_receipt BEFORE UPDATE ON StripeWebhookReceipt FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic failure-receipt fault'",
      drop: 'DROP TRIGGER IF EXISTS cf_fail_failure_receipt',
      name: 'receipt transition',
      subscriptionId: 'sub_failure_receipt_rollback',
    },
    {
      create:
        "CREATE TRIGGER cf_fail_failure_release BEFORE DELETE ON StripeWebhookObjectLease FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic failure-release fault'",
      drop: 'DROP TRIGGER IF EXISTS cf_fail_failure_release',
      name: 'object release',
      subscriptionId: 'sub_failure_object_rollback',
    },
  ]) {
    const rollbackRow = await createReceipt(client, {
      subscriptionId: stage.subscriptionId,
    })
    const rollbackClaim = await claimForProjection(
      rollbackRow.id,
      stage.subscriptionId,
      `failure-${stage.name}`
    )
    await executeNativeMySql(stage.create)
    try {
      await expectFailure(`failure ${stage.name} fault`, () =>
        rollbackClaim.store.failReceipt({
          error: safeError,
          now: new Date(now.getTime() + 2),
          objectLease: rollbackClaim.objectLease,
          receiptId: rollbackRow.id,
          receiptLeaseToken: rollbackClaim.receipt.leaseToken!,
        })
      )
    } finally {
      await executeNativeMySql(stage.drop)
    }
    assert(
      (
        await client.stripeWebhookReceipt.findUniqueOrThrow({
          where: { id: rollbackRow.id },
        })
      ).status === 'PROCESSING',
      `${stage.name} fault left a partial failure transition`
    )
    assert(
      (await client.stripeWebhookObjectLease.count({
        where: { objectId: stage.subscriptionId },
      })) === 1,
      `${stage.name} fault lost the owned lease`
    )
  }
}

const projection = (input: {
  agencyId?: string
  customerId?: string
  priceId?: string
  subscriptionId?: string
} = {}) => ({
  active: false,
  agencyId: input.agencyId ?? 'agency_a',
  currentPeriodEndDate: new Date('2032-01-01T00:00:00.000Z'),
  customerId: input.customerId ?? 'cus_agency',
  logicalPlan: 'BASIC' as const,
  priceId: input.priceId ?? 'price_basic',
  subscriptionId: input.subscriptionId ?? 'sub_agency',
})

const claimForProjection = async (
  receiptId: string,
  subscriptionId: string,
  tokenSuffix: string
) => {
  const store = createPrismaWebhookProcessingAdapters(client).store
  const receipt = await store.claimReceipt({
    leaseToken: `receipt-${tokenSuffix}`,
    now,
    receiptId,
  })
  assert(receipt, 'Projection receipt could not be claimed')
  const objectLease = await store.claimObjectLease({
    key: {
      accountScopeKey: 'platform',
      mode: 'TEST',
      objectId: subscriptionId,
      objectType: 'subscription',
    },
    leaseToken: `object-${tokenSuffix}`,
    now,
  })
  assert(objectLease, 'Projection object lease could not be claimed')
  return { objectLease, receipt, store }
}

const verifyProjectionAndRollback = async () => {
  await clearWebhookState()
  const legacyReceipt = await createReceipt(client, {
    customerId: 'cus_legacy',
    subscriptionId: 'sub_legacy',
  })
  const legacyClaim = await claimForProjection(
    legacyReceipt.id,
    'sub_legacy',
    'legacy'
  )
  assert(
    await legacyClaim.store.projectAndComplete({
      now: new Date(now.getTime() + 1),
      objectLease: legacyClaim.objectLease,
      projection: projection({
        agencyId: 'agency_legacy',
        customerId: 'cus_legacy',
        priceId: 'price_basic',
        subscriptionId: 'sub_legacy',
      }),
      receiptId: legacyReceipt.id,
      receiptLeaseToken: legacyClaim.receipt.leaseToken!,
    }),
    'Legacy projection did not complete'
  )
  const legacy = await client.subscription.findUniqueOrThrow({
    where: { id: 'subscription_legacy' },
  })
  assert(
    legacy.plan === 'price_1OYxkqFj9oKEERu1NbKUxXxN' &&
      legacy.price === 'legacy-price-marker',
    'Projection rewrote legacy plan fields'
  )
  assert(
    legacy.logicalPlan === 'BASIC' && legacy.priceId === 'price_basic',
    'Projection did not persist current logical plan and Price'
  )

  const collisionReceipt = await createReceipt(client, {
    subscriptionId: 'sub_legacy',
  })
  const collisionClaim = await claimForProjection(
    collisionReceipt.id,
    'sub_legacy',
    'collision'
  )
  assert(
    !(await collisionClaim.store.projectAndComplete({
      now: new Date(now.getTime() + 1),
      objectLease: collisionClaim.objectLease,
      projection: projection({ subscriptionId: 'sub_legacy' }),
      receiptId: collisionReceipt.id,
      receiptLeaseToken: collisionClaim.receipt.leaseToken!,
    })),
    'Foreign provider-subscription binding was reassigned'
  )

  await client.$executeRawUnsafe(
    "INSERT INTO Agency (id, customerId, name) VALUES ('agency_duplicate', 'cus_agency', 'Duplicate Synthetic Agency')"
  )
  const ambiguousReceipt = await createReceipt(client, {
    subscriptionId: 'sub_ambiguous',
  })
  const ambiguousClaim = await claimForProjection(
    ambiguousReceipt.id,
    'sub_ambiguous',
    'ambiguous'
  )
  assert(
    !(await ambiguousClaim.store.projectAndComplete({
      now: new Date(now.getTime() + 1),
      objectLease: ambiguousClaim.objectLease,
      projection: projection({ subscriptionId: 'sub_ambiguous' }),
      receiptId: ambiguousReceipt.id,
      receiptLeaseToken: ambiguousClaim.receipt.leaseToken!,
    })),
    'Ambiguous agency ownership projected'
  )
  await client.$executeRawUnsafe("DELETE FROM Agency WHERE id = 'agency_duplicate'")

  const conflictingAgencyReceipt = await createReceipt(client, {
    subscriptionId: 'sub_conflicting_agency',
  })
  await client.subscription.create({
    data: {
      active: true,
      agencyId: 'agency_a',
      currentPeriodEndDate: new Date('2031-01-01T00:00:00.000Z'),
      customerId: 'cus_agency',
      id: 'subscription_conflicting_agency',
      logicalPlan: 'BASIC',
      plan: 'price_1OYxkqFj9oKEERu1NbKUxXxN',
      price: 'legacy-conflict-marker',
      priceId: 'price_basic',
      subscritiptionId: 'sub_existing_agency',
    },
  })
  const conflictingAgencyClaim = await claimForProjection(
    conflictingAgencyReceipt.id,
    'sub_conflicting_agency',
    'conflicting-agency'
  )
  assert(
    !(await conflictingAgencyClaim.store.projectAndComplete({
      now: new Date(now.getTime() + 1),
      objectLease: conflictingAgencyClaim.objectLease,
      projection: projection({ subscriptionId: 'sub_conflicting_agency' }),
      receiptId: conflictingAgencyReceipt.id,
      receiptLeaseToken: conflictingAgencyClaim.receipt.leaseToken!,
    })),
    'Projection reassigned an agency subscription identity'
  )
  assert(
    (
      await client.subscription.findUniqueOrThrow({
        where: { agencyId: 'agency_a' },
      })
    ).subscritiptionId === 'sub_existing_agency',
    'Conflicting agency row was modified'
  )
  await client.subscription.delete({
    where: { id: 'subscription_conflicting_agency' },
  })

  const emptyBindingReceipt = await createReceipt(client, {
    subscriptionId: 'sub_empty_binding',
  })
  await client.subscription.create({
    data: {
      active: true,
      agencyId: 'agency_a',
      currentPeriodEndDate: new Date('2031-01-01T00:00:00.000Z'),
      customerId: 'cus_agency',
      id: 'subscription_empty_binding',
      logicalPlan: 'BASIC',
      plan: 'price_1OYxkqFj9oKEERu1NbKUxXxN',
      price: 'legacy-empty-binding-marker',
      priceId: 'price_basic',
      subscritiptionId: '',
    },
  })
  const emptyBindingClaim = await claimForProjection(
    emptyBindingReceipt.id,
    'sub_empty_binding',
    'empty-binding'
  )
  assert(
    !(await emptyBindingClaim.store.projectAndComplete({
      now: new Date(now.getTime() + 1),
      objectLease: emptyBindingClaim.objectLease,
      projection: projection({ subscriptionId: 'sub_empty_binding' }),
      receiptId: emptyBindingReceipt.id,
      receiptLeaseToken: emptyBindingClaim.receipt.leaseToken!,
    })),
    'Projection reassigned an empty stored provider binding'
  )
  const emptyBinding = await client.subscription.findUniqueOrThrow({
    where: { id: 'subscription_empty_binding' },
  })
  assert(
    emptyBinding.subscritiptionId === '' &&
      emptyBinding.plan === 'price_1OYxkqFj9oKEERu1NbKUxXxN' &&
      emptyBinding.price === 'legacy-empty-binding-marker',
    'Empty stored binding or legacy fields were modified'
  )
  assert(
    (
      await client.stripeWebhookReceipt.findUniqueOrThrow({
        where: { id: emptyBindingReceipt.id },
      })
    ).status === 'PROCESSING',
    'Empty stored binding produced a false terminal receipt'
  )
  await client.subscription.delete({
    where: { id: 'subscription_empty_binding' },
  })

  const bindingReceipt = await createReceipt(client, {
    subscriptionId: 'sub_binding',
  })
  const bindingStore = createPrismaWebhookProcessingAdapters(client).store
  const bindingClaim = await bindingStore.claimReceipt({
    leaseToken: 'receipt-binding',
    now,
    receiptId: bindingReceipt.id,
  })
  assert(bindingClaim, 'Binding receipt could not be claimed')
  const unrelatedLease = await bindingStore.claimObjectLease({
    key: {
      accountScopeKey: 'platform',
      mode: 'TEST',
      objectId: 'sub_unrelated',
      objectType: 'subscription',
    },
    leaseToken: 'object-unrelated',
    now,
  })
  assert(unrelatedLease, 'Unrelated object lease could not be claimed')
  assert(
    !(await bindingStore.projectAndComplete({
      now: new Date(now.getTime() + 1),
      objectLease: unrelatedLease,
      projection: projection({ subscriptionId: 'sub_binding' }),
      receiptId: bindingReceipt.id,
      receiptLeaseToken: bindingClaim.leaseToken!,
    })),
    'Projection accepted an object lease unrelated to the receipt'
  )
  assert(
    !(await client.subscription.findUnique({
      where: { subscritiptionId: 'sub_binding' },
    })),
    'Object-identity mismatch created a projection'
  )

  const customerBindingReceipt = await createReceipt(client, {
    subscriptionId: 'sub_customer_binding',
  })
  const customerBindingClaim = await claimForProjection(
    customerBindingReceipt.id,
    'sub_customer_binding',
    'customer-binding'
  )
  assert(
    !(await customerBindingClaim.store.projectAndComplete({
      now: new Date(now.getTime() + 1),
      objectLease: customerBindingClaim.objectLease,
      projection: projection({
        agencyId: 'agency_legacy',
        customerId: 'cus_legacy',
        subscriptionId: 'sub_customer_binding',
      }),
      receiptId: customerBindingReceipt.id,
      receiptLeaseToken: customerBindingClaim.receipt.leaseToken!,
    })),
    'Projection accepted a Customer unrelated to the receipt'
  )

  const connectedBindingReceipt = await createReceipt(client, {
    accountScopeKey: 'connected:acct_synthetic',
    subscriptionId: 'sub_connected_binding',
  })
  const connectedStore = createPrismaWebhookProcessingAdapters(client).store
  const connectedClaim = await connectedStore.claimReceipt({
    leaseToken: 'receipt-connected-binding',
    now,
    receiptId: connectedBindingReceipt.id,
  })
  assert(connectedClaim, 'Connected binding receipt could not be claimed')
  const connectedLease = await connectedStore.claimObjectLease({
    key: {
      accountScopeKey: 'connected:acct_synthetic',
      mode: 'TEST',
      objectId: 'sub_connected_binding',
      objectType: 'subscription',
    },
    leaseToken: 'object-connected-binding',
    now,
  })
  assert(connectedLease, 'Connected binding lease could not be claimed')
  assert(
    !(await connectedStore.projectAndComplete({
      now: new Date(now.getTime() + 1),
      objectLease: connectedLease,
      projection: projection({ subscriptionId: 'sub_connected_binding' }),
      receiptId: connectedBindingReceipt.id,
      receiptLeaseToken: connectedClaim.leaseToken!,
    })),
    'Connected-account receipt gained projection authority'
  )

  const stages = [
    {
      create:
        "CREATE TRIGGER cf_fail_subscription BEFORE INSERT ON Subscription FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic subscription failure'",
      drop: 'DROP TRIGGER IF EXISTS cf_fail_subscription',
      name: 'subscription',
      subscriptionId: 'sub_atomic_subscription',
    },
    {
      create:
        "CREATE TRIGGER cf_fail_receipt BEFORE UPDATE ON StripeWebhookReceipt FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic receipt failure'",
      drop: 'DROP TRIGGER IF EXISTS cf_fail_receipt',
      name: 'receipt',
      subscriptionId: 'sub_atomic_receipt',
    },
    {
      create:
        "CREATE TRIGGER cf_fail_object_delete BEFORE DELETE ON StripeWebhookObjectLease FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic object failure'",
      drop: 'DROP TRIGGER IF EXISTS cf_fail_object_delete',
      name: 'object release',
      subscriptionId: 'sub_atomic_object',
    },
  ]
  for (const stage of stages) {
    const row = await createReceipt(client, { subscriptionId: stage.subscriptionId })
    const claim = await claimForProjection(row.id, stage.subscriptionId, stage.name)
    await executeNativeMySql(stage.create)
    try {
      await expectFailure(`${stage.name} transaction fault`, () =>
        claim.store.projectAndComplete({
          now: new Date(now.getTime() + 1),
          objectLease: claim.objectLease,
          projection: projection({ subscriptionId: stage.subscriptionId }),
          receiptId: row.id,
          receiptLeaseToken: claim.receipt.leaseToken!,
        })
      )
    } finally {
      await executeNativeMySql(stage.drop)
    }
    assert(
      !(await client.subscription.findUnique({
        where: { subscritiptionId: stage.subscriptionId },
      })),
      `${stage.name} fault left a partial subscription projection`
    )
    assert(
      (await client.stripeWebhookReceipt.findUniqueOrThrow({ where: { id: row.id } }))
        .status === 'PROCESSING',
      `${stage.name} fault left a false terminal receipt`
    )
    assert(
      (await client.stripeWebhookObjectLease.count({
        where: { objectId: stage.subscriptionId },
      })) === 1,
      `${stage.name} fault released the object lease outside the transaction`
    )
  }
}

const verifyWorker = async () => {
  await clearWebhookState()
  const platform = await createReceipt(client, { subscriptionId: 'sub_worker' })
  const connected = await createReceipt(client, {
    accountScopeKey: 'connected:acct_synthetic',
    subscriptionId: 'sub_connected',
  })
  const unsupported = await createReceipt(client, {
    eventType: 'product.updated',
    subscriptionId: null,
  })
  const adapters = createPrismaWebhookProcessingAdapters(client)
  let providerCalls = 0
  const provider = {
    retrieveCustomer: async (input: { customerId: string }) => {
      providerCalls += 1
      assert(input.customerId === 'cus_agency', 'Worker passed the wrong Customer ID')
      return customerSnapshot()
    },
    retrieveSubscription: async (input: {
      accountScopeKey: string
      mode: 'LIVE' | 'TEST'
      subscriptionId: string
    }) => {
      providerCalls += 1
      assert(input.mode === 'TEST', 'Worker passed a non-Test provider mode')
      assert(input.accountScopeKey === 'platform', 'Worker passed a non-platform provider scope')
      assert(input.subscriptionId === 'sub_worker', 'Worker passed the wrong Subscription ID')
      return subscriptionSnapshot('sub_worker')
    },
  }
  const summary = await runStripeWebhookWorkerOnce(
    { limit: 25 },
    {
      ...adapters,
      now: () => now,
      provider,
      randomToken: randomUUID,
    }
  )
  assert(
    summary.succeeded === 1 && summary.ignored === 2 && summary.attempted === 3,
    'Worker did not process the bounded mixed batch'
  )
  assert(providerCalls === 2, 'Ignored work reached the provider boundary')
  for (const id of [connected.id, unsupported.id]) {
    assert(
      (await client.stripeWebhookReceipt.findUniqueOrThrow({ where: { id } })).status ===
        'IGNORED',
      'Ignored worker receipt was not durable'
    )
  }
  assert(
    (await client.stripeWebhookReceipt.findUniqueOrThrow({ where: { id: platform.id } }))
      .status === 'SUCCEEDED',
    'Supported worker receipt was not durable'
  )
  const repeated = await runStripeWebhookWorkerOnce(
    { limit: 25 },
    {
      ...adapters,
      now: () => now,
      provider,
      randomToken: randomUUID,
    }
  )
  assert(
    repeated.selected === 0 && repeated.attempted === 0 && providerCalls === 2,
    'Repeated real-store run did not terminate empty without provider work'
  )
}

const verifyNegativeReconciliation = async () => {
  await clearWebhookState()
  const cases: Array<{
    customer: (subscriptionId: string) => StripeWebhookCustomer | null
    name: string
    receiptCustomerId?: string
    subscription: (subscriptionId: string) => StripeSubscriptionInput | null
  }> = [
    {
      customer: () => customerSnapshot(),
      name: 'missing_subscription',
      subscription: () => null,
    },
    {
      customer: () => ({ ...customerSnapshot(), deleted: true }),
      name: 'deleted_customer',
      subscription: (subscriptionId) => subscriptionSnapshot(subscriptionId),
    },
    {
      customer: () => customerSnapshot('cus_foreign'),
      name: 'foreign_customer',
      subscription: (subscriptionId) => subscriptionSnapshot(subscriptionId),
    },
    {
      customer: () => customerSnapshot('cus_agency', 'agency_legacy'),
      name: 'metadata_mismatch',
      subscription: (subscriptionId) => subscriptionSnapshot(subscriptionId),
    },
    {
      customer: () => customerSnapshot('cus_unowned', 'agency_missing'),
      name: 'missing_agency',
      receiptCustomerId: 'cus_unowned',
      subscription: (subscriptionId) =>
        subscriptionSnapshot(subscriptionId, 'cus_unowned'),
    },
    {
      customer: () => customerSnapshot(),
      name: 'foreign_subscription_customer',
      subscription: (subscriptionId) =>
        subscriptionSnapshot(subscriptionId, 'cus_foreign'),
    },
    {
      customer: () => customerSnapshot(),
      name: 'inactive_price',
      subscription: (subscriptionId) =>
        withPrice(subscriptionSnapshot(subscriptionId), { active: false }),
    },
    {
      customer: () => customerSnapshot(),
      name: 'unknown_price',
      subscription: (subscriptionId) =>
        withPrice(subscriptionSnapshot(subscriptionId), {
          lookup_key: 'foreign_plan',
        }),
    },
    {
      customer: () => customerSnapshot(),
      name: 'mode_mismatch',
      subscription: (subscriptionId) =>
        withPrice(subscriptionSnapshot(subscriptionId), { livemode: true }),
    },
    {
      customer: () => customerSnapshot(),
      name: 'invalid_subscription',
      subscription: (subscriptionId) => {
        const subscription = subscriptionSnapshot(subscriptionId)
        return {
          ...subscription,
          items: {
            data: [
              { ...subscription.items.data[0], current_period_end: 0 },
            ],
          },
        }
      },
    },
  ]
  for (const negative of cases) {
    const subscriptionId = `sub_negative_${negative.name}`
    const row = await createReceipt(client, {
      customerId: negative.receiptCustomerId,
      subscriptionId,
    })
    const adapters = createPrismaWebhookProcessingAdapters(client)
    const result = await processStripeWebhookReceipt(row.id, {
      ...adapters,
      now: () => now,
      provider: {
        retrieveCustomer: async () => negative.customer(subscriptionId),
        retrieveSubscription: async () => negative.subscription(subscriptionId),
      },
      randomToken: randomUUID,
    })
    assert(
      result.disposition === 'dead-letter',
      `${negative.name} did not become a bounded terminal failure`
    )
    const persisted = await client.stripeWebhookReceipt.findUniqueOrThrow({
      where: { id: row.id },
    })
    assert(
      persisted.status === 'DEAD_LETTER',
      `${negative.name} did not persist dead-letter state`
    )
    assert(
      !(await client.subscription.findUnique({
        where: { subscritiptionId: subscriptionId },
      })),
      `${negative.name} created a subscription projection`
    )
    assert(
      (await client.stripeWebhookObjectLease.count({
        where: { objectId: subscriptionId },
      })) === 0,
      `${negative.name} left an object lease behind`
    )
  }

  await client.$executeRawUnsafe(
    "INSERT INTO Agency (id, customerId, name) VALUES ('agency_duplicate', 'cus_agency', 'Duplicate Synthetic Agency')"
  )
  try {
    const ambiguousId = 'sub_negative_ambiguous_agency'
    const ambiguous = await createReceipt(client, {
      subscriptionId: ambiguousId,
    })
    const adapters = createPrismaWebhookProcessingAdapters(client)
    const result = await processStripeWebhookReceipt(ambiguous.id, {
      ...adapters,
      now: () => now,
      provider: {
        retrieveCustomer: async () => customerSnapshot(),
        retrieveSubscription: async () => subscriptionSnapshot(ambiguousId),
      },
      randomToken: randomUUID,
    })
    assert(
      result.disposition === 'dead-letter',
      'Ambiguous real-store ownership did not fail closed'
    )
    assert(
      !(await client.subscription.findUnique({
        where: { subscritiptionId: ambiguousId },
      })),
      'Ambiguous real-store ownership projected a subscription'
    )
  } finally {
    await client.$executeRawUnsafe("DELETE FROM Agency WHERE id = 'agency_duplicate'")
  }

  const hostileId = 'sub_negative_hostile_provider'
  const hostile = await createReceipt(client, { subscriptionId: hostileId })
  const adapters = createPrismaWebhookProcessingAdapters(client)
  const hostileResult = await processStripeWebhookReceipt(hostile.id, {
    ...adapters,
    now: () => now,
    provider: {
      retrieveCustomer: async () => customerSnapshot(),
      retrieveSubscription: async () => {
        throw new Error(
          `${['raw', 'provider', 'credential'].join('-')} synthetic-customer-address`
        )
      },
    },
    randomToken: randomUUID,
  })
  assert(hostileResult.disposition === 'retry', 'Hostile provider error did not retry')
  const hostilePersisted = await client.stripeWebhookReceipt.findUniqueOrThrow({
    where: { id: hostile.id },
  })
  assert(
    hostilePersisted.lastErrorCode === 'provider_temporarily_unavailable' &&
      hostilePersisted.lastErrorMessage ===
        'Webhook provider state could not be retrieved',
    'Hostile provider details escaped the bounded diagnostic'
  )
  assert(
    (await client.stripeWebhookObjectLease.count({
      where: { objectId: hostileId },
    })) === 0,
    'Hostile provider failure left an object lease behind'
  )
}

const verifyReorderedConvergence = async () => {
  await clearWebhookState()
  const subscriptionId = 'sub_reordered'
  const created = await createReceipt(client, {
    eventType: 'customer.subscription.created',
    subscriptionId,
  })
  const deleted = await createReceipt(client, {
    eventType: 'customer.subscription.deleted',
    subscriptionId,
  })
  const adapters = createPrismaWebhookProcessingAdapters(client)
  const provider = {
    retrieveCustomer: async () => customerSnapshot(),
    retrieveSubscription: async () =>
      subscriptionSnapshot(subscriptionId, 'cus_agency', 'canceled'),
  }
  for (const row of [deleted, created]) {
    const result = await processStripeWebhookReceipt(row.id, {
      ...adapters,
      now: () => now,
      provider,
      randomToken: randomUUID,
    })
    assert(
      result.disposition === 'succeeded',
      'Reordered lifecycle receipt did not converge'
    )
  }
  const projected = await client.subscription.findUniqueOrThrow({
    where: { agencyId: 'agency_a' },
  })
  assert(
    projected.subscritiptionId === subscriptionId && projected.active === false,
    'Reordered equal-provider-time receipts did not use current provider state'
  )
  assert(
    (await client.stripeWebhookReceipt.count({
      where: { id: { in: [created.id, deleted.id] }, status: 'SUCCEEDED' },
    })) === 2,
    'Reordered lifecycle receipts did not both terminate durably'
  )
}

const verifyConcurrentProcessors = async () => {
  await clearWebhookState()
  const first = await createReceipt(client, { subscriptionId: 'sub_serial' })
  const second = await createReceipt(client, { subscriptionId: 'sub_serial' })
  const firstClient = new PrismaClient()
  const secondClient = new PrismaClient()
  clients.push(firstClient, secondClient)
  const firstAdapters = createPrismaWebhookProcessingAdapters(firstClient)
  const secondAdapters = createPrismaWebhookProcessingAdapters(secondClient)
  let release!: () => void
  let entered!: () => void
  const atProvider = new Promise<void>((resolve) => {
    entered = resolve
  })
  const barrier = new Promise<void>((resolve) => {
    release = resolve
  })
  let reads = 0
  const provider = {
    retrieveCustomer: async () => customerSnapshot(),
    retrieveSubscription: async () => {
      reads += 1
      if (reads === 1) {
        entered()
        await barrier
      }
      return subscriptionSnapshot('sub_serial')
    },
  }
  const firstRun = processStripeWebhookReceipt(first.id, {
    ...firstAdapters,
    now: () => now,
    provider,
    randomToken: randomUUID,
  })
  await atProvider
  const secondRun = await processStripeWebhookReceipt(second.id, {
    ...secondAdapters,
    now: () => now,
    provider,
    randomToken: randomUUID,
  })
  assert(secondRun.disposition === 'retry', 'Object-lease loser did not become retryable')
  release()
  assert((await firstRun).disposition === 'succeeded', 'Object-lease winner failed')

  const retryAt = new Date(now.getTime() + 30_001)
  assert(
    (
      await processStripeWebhookReceipt(second.id, {
        ...secondAdapters,
        now: () => retryAt,
        provider,
        randomToken: randomUUID,
      })
    ).disposition === 'succeeded',
    'Serialized loser did not later converge'
  )
  assert(
    (await client.subscription.count({ where: { subscritiptionId: 'sub_serial' } })) ===
      1,
    'Concurrent processors created multiple projections'
  )
}

const verifyStaleWorkerRecovery = async () => {
  await clearWebhookState()
  const row = await createReceipt(client, { subscriptionId: 'sub_recovered' })
  const staleClient = new PrismaClient()
  const recoveryClient = new PrismaClient()
  clients.push(staleClient, recoveryClient)
  const staleAdapters = createPrismaWebhookProcessingAdapters(staleClient)
  const recoveryAdapters = createPrismaWebhookProcessingAdapters(recoveryClient)
  let releaseStale!: () => void
  let staleEntered!: () => void
  const staleAtProvider = new Promise<void>((resolve) => {
    staleEntered = resolve
  })
  const staleBarrier = new Promise<void>((resolve) => {
    releaseStale = resolve
  })
  const staleProvider = {
    retrieveCustomer: async () => customerSnapshot(),
    retrieveSubscription: async () => {
      staleEntered()
      await staleBarrier
      return subscriptionSnapshot('sub_recovered')
    },
  }
  const recoveryProvider = {
    retrieveCustomer: async () => customerSnapshot(),
    retrieveSubscription: async () => subscriptionSnapshot('sub_recovered'),
  }
  const staleRun = processStripeWebhookReceipt(row.id, {
    ...staleAdapters,
    now: () => now,
    provider: staleProvider,
    randomToken: () => 'stale-receipt-or-object',
  })
  await staleAtProvider
  const reclaimAt = new Date(now.getTime() + 60_000)
  const recovered = await processStripeWebhookReceipt(row.id, {
    ...recoveryAdapters,
    now: () => reclaimAt,
    provider: recoveryProvider,
    randomToken: randomUUID,
  })
  assert(recovered.disposition === 'succeeded', 'Recovered worker did not converge')
  releaseStale()
  assert(
    (await staleRun).disposition === 'busy',
    'Stale worker reported or overwrote recovered work'
  )
  const persisted = await client.stripeWebhookReceipt.findUniqueOrThrow({
    where: { id: row.id },
  })
  assert(
    persisted.status === 'SUCCEEDED' && persisted.attempts === 2,
    'Process-loss recovery did not preserve the recovered terminal state'
  )
  assert(
    (await client.subscription.count({
      where: { subscritiptionId: 'sub_recovered' },
    })) === 1,
    'Stale and recovered workers created duplicate projections'
  )
  assert(
    (await client.stripeWebhookObjectLease.count({
      where: { objectId: 'sub_recovered' },
    })) === 0,
    'Recovered work left an object lease behind'
  )
}

const verifyStaleLeaseIsolation = async () => {
  await clearWebhookState()
  const row = await createReceipt(client, { subscriptionId: 'sub_stale_lease' })
  const stale = await claimForProjection(
    row.id,
    'sub_stale_lease',
    'stale-isolation'
  )
  const reclaimAt = new Date(now.getTime() + 60_000)
  const recoveredStore = createPrismaWebhookProcessingAdapters(client).store
  const recoveredReceipt = await recoveredStore.claimReceipt({
    leaseToken: 'receipt-recovered-isolation',
    now: reclaimAt,
    receiptId: row.id,
  })
  assert(recoveredReceipt, 'Recovered receipt lease could not be claimed')
  const recoveredObject = await recoveredStore.claimObjectLease({
    key: {
      accountScopeKey: 'platform',
      mode: 'TEST',
      objectId: 'sub_stale_lease',
      objectType: 'subscription',
    },
    leaseToken: 'object-recovered-isolation',
    now: reclaimAt,
  })
  assert(recoveredObject, 'Recovered object lease could not be claimed')
  const actAt = new Date(reclaimAt.getTime() + 1)
  assert(
    !(await stale.store.projectAndComplete({
      now: actAt,
      objectLease: stale.objectLease,
      projection: projection({ subscriptionId: 'sub_stale_lease' }),
      receiptId: row.id,
      receiptLeaseToken: stale.receipt.leaseToken!,
    })),
    'Stale worker projected after lease replacement'
  )
  assert(
    !(await stale.store.failReceipt({
      error: {
        code: 'stale_failure',
        message: 'Stale worker failed',
        retryable: true,
      },
      now: actAt,
      objectLease: stale.objectLease,
      receiptId: row.id,
      receiptLeaseToken: stale.receipt.leaseToken!,
    })),
    'Stale worker failed reclaimed work'
  )
  const afterStaleReceipt = await client.stripeWebhookReceipt.findUniqueOrThrow({
    where: { id: row.id },
  })
  const afterStaleObject = await client.stripeWebhookObjectLease.findFirstOrThrow({
    where: { objectId: 'sub_stale_lease' },
  })
  assert(
    afterStaleReceipt.status === 'PROCESSING' &&
      afterStaleReceipt.leaseToken === recoveredReceipt.leaseToken,
    'Stale worker changed the recovered receipt lease'
  )
  assert(
    afterStaleObject.leaseToken === recoveredObject.leaseToken,
    'Stale worker changed or released the recovered object lease'
  )
  assert(
    await recoveredStore.projectAndComplete({
      now: actAt,
      objectLease: recoveredObject,
      projection: projection({ subscriptionId: 'sub_stale_lease' }),
      receiptId: row.id,
      receiptLeaseToken: recoveredReceipt.leaseToken!,
    }),
    'Recovered worker could not complete after stale actions'
  )
}

const verifySameReceiptProcessors = async () => {
  await clearWebhookState()
  const row = await createReceipt(client, { subscriptionId: 'sub_same_receipt' })
  const winnerClient = new PrismaClient()
  const loserClient = new PrismaClient()
  clients.push(winnerClient, loserClient)
  const winnerAdapters = createPrismaWebhookProcessingAdapters(winnerClient)
  const loserAdapters = createPrismaWebhookProcessingAdapters(loserClient)
  let entered!: () => void
  let release!: () => void
  const atProvider = new Promise<void>((resolve) => {
    entered = resolve
  })
  const barrier = new Promise<void>((resolve) => {
    release = resolve
  })
  let providerReads = 0
  const provider = {
    retrieveCustomer: async () => customerSnapshot(),
    retrieveSubscription: async () => {
      providerReads += 1
      entered()
      await barrier
      return subscriptionSnapshot('sub_same_receipt')
    },
  }
  const winner = processStripeWebhookReceipt(row.id, {
    ...winnerAdapters,
    now: () => now,
    provider,
    randomToken: randomUUID,
  })
  await atProvider
  const loser = await processStripeWebhookReceipt(row.id, {
    ...loserAdapters,
    now: () => now,
    provider,
    randomToken: randomUUID,
  })
  assert(loser.disposition === 'busy', 'Same-receipt loser was not safely busy')
  assert(providerReads === 1, 'Same-receipt loser reached the provider')
  release()
  assert((await winner).disposition === 'succeeded', 'Same-receipt winner failed')
  const persisted = await client.stripeWebhookReceipt.findUniqueOrThrow({
    where: { id: row.id },
  })
  assert(
    persisted.status === 'SUCCEEDED' && persisted.attempts === 1,
    'Same-receipt contention incremented or completed more than once'
  )
  assert(
    (await client.subscription.count({
      where: { subscritiptionId: 'sub_same_receipt' },
    })) === 1,
    'Same-receipt contention created multiple projections'
  )
}

const verifySuccess = async () => {
  await verifySelection()
  await verifyReceiptClaims()
  await verifyObjectLeaseClaims()
  await verifyRetrySchedule()
  await verifyFailureAndObjectRelease()
  await verifyProjectionAndRollback()
  await verifyWorker()
  await verifyNegativeReconciliation()
  await verifyReorderedConvergence()
  await verifySameReceiptProcessors()
  await verifyConcurrentProcessors()
  await verifyStaleLeaseIsolation()
  await verifyStaleWorkerRecovery()
  console.log(
    'PASS success: selection, claims, leases, retries, rollback, projection, negative reconciliation, worker, concurrency, and recovery'
  )
}

const main = async () => {
  try {
    const adapters = createPrismaWebhookProcessingAdapters(client)
    if (scenario === 'missing' || scenario === 'outage') {
      await expectFailure(scenario, () =>
        adapters.dueWork.listDueReceiptIds({ limit: 1, now })
      )
      console.log(`PASS ${scenario}: processing store failed closed`)
    } else {
      await verifySuccess()
    }
  } finally {
    await Promise.allSettled(clients.map((database) => database.$disconnect()))
  }
}

void main()
