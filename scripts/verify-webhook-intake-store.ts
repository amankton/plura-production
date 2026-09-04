import { createHash } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import {
  createPrismaWebhookIntakeStore,
  type PrismaWebhookReceiptDelegate,
} from '../src/lib/stripe/prisma-webhook-intake-store-core'
import { receiveStripeWebhook } from '../src/lib/stripe/webhook-intake'
import type { StripeWebhookReceiptDraft } from '../src/lib/stripe/webhook-inbox-contract'

const scenario = process.argv[2]
if (!['legacy', 'missing', 'outage', 'success'].includes(scenario)) {
  throw new Error('A supported webhook intake store scenario is required')
}

const client = new PrismaClient()
const delegate: PrismaWebhookReceiptDelegate = {
  create: (input) => client.stripeWebhookReceipt.create(input),
  findUnique: (input) => client.stripeWebhookReceipt.findUnique(input),
}
const store = createPrismaWebhookIntakeStore(delegate)

const draft = (
  eventId: string,
  payloadHash = 'a'.repeat(64)
): StripeWebhookReceiptDraft => ({
  accountScopeKey: 'platform',
  customerId: 'cus_disposable',
  eventId,
  eventType: 'customer.subscription.updated',
  mode: 'TEST',
  objectId: 'sub_disposable',
  payloadHash,
  providerCreatedAt: new Date('2026-09-03T18:00:00.000Z'),
  retentionExpiresAt: new Date('2026-10-03T18:00:00.000Z'),
  subscriptionId: 'sub_disposable',
})

const expectFailure = async (name: string) => {
  let failed = false
  try {
    await store.insertOrGet(draft(`evt_${name}`))
  } catch {
    failed = true
  }
  if (!failed) throw new Error(`${name} scenario did not fail closed`)
  console.log(`PASS ${name}: Prisma intake failed closed`)
}

const verifySuccess = async () => {
  const raceDraft = draft('evt_disposable_race')
  let arrivals = 0
  let releaseRace: (() => void) | undefined
  const allArrived = new Promise<void>((resolve) => {
    releaseRace = resolve
  })
  const barrierStore = createPrismaWebhookIntakeStore({
    create: async (input) => {
      arrivals += 1
      if (arrivals === 20) releaseRace?.()
      await allArrived
      return client.stripeWebhookReceipt.create(input)
    },
    findUnique: (input) => client.stripeWebhookReceipt.findUnique(input),
  })
  const results = await Promise.all(
    Array.from({ length: 20 }, () => barrierStore.insertOrGet(raceDraft))
  )
  if (results.filter(({ inserted }) => inserted).length !== 1) {
    throw new Error('Concurrent duplicate race did not produce one insert')
  }
  if (new Set(results.map(({ receipt }) => receipt.id)).size !== 1) {
    throw new Error('Concurrent duplicates did not resolve one receipt')
  }
  const raceCount = await client.stripeWebhookReceipt.count({
    where: {
      accountScopeKey: raceDraft.accountScopeKey,
      eventId: raceDraft.eventId,
      mode: raceDraft.mode,
    },
  })
  if (raceCount !== 1) throw new Error('Duplicate race persisted extra rows')

  const collisionEvent = {
    created: 1_788_456_000,
    data: {
      object: {
        customer: 'cus_disposable',
        id: 'sub_disposable',
        object: 'subscription',
      },
    },
    id: 'evt_disposablecollision',
    livemode: false,
    type: 'customer.subscription.updated',
  }
  const firstBody = Buffer.from(JSON.stringify(collisionEvent))
  const secondBody = Buffer.from(JSON.stringify(collisionEvent, null, 2))
  const intake = (body: Buffer) =>
    receiveStripeWebhook(
      {
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(Uint8Array.from(body))
            controller.close()
          },
        }),
        mode: 'TEST',
        signature: 'synthetic-signature',
      },
      {
        receiptStore: store,
        secrets: { TEST: 'synthetic-endpoint-secret' },
        verifySignature: () => collisionEvent,
      }
    )
  const first = await intake(firstBody)
  const second = await intake(secondBody)
  if (!first.ok || !first.inserted) {
    throw new Error('Initial collision fixture was not inserted')
  }
  if (second.ok || second.code !== 'event_identity_conflict') {
    throw new Error('Different signed bytes did not fail identity collision')
  }
  const collisionRows = await client.stripeWebhookReceipt.findMany({
    where: { eventId: collisionEvent.id },
    select: { payloadHash: true },
  })
  const firstHash = createHash('sha256').update(firstBody).digest('hex')
  if (
    collisionRows.length !== 1 ||
    collisionRows[0].payloadHash !== firstHash
  ) {
    throw new Error('Identity collision mutated or duplicated the stored row')
  }
  console.log('PASS success: real MySQL race and hash collision checks passed')
}

const verifyLegacy = async () => {
  const rows = await client.$queryRaw<Array<{ count: bigint }>>(
    Prisma.sql`SELECT COUNT(*) AS count FROM Subscription WHERE id = 'subscription_legacy' AND agencyId = 'agency_legacy'`
  )
  if (rows.length !== 1 || rows[0].count !== BigInt(1)) {
    throw new Error('Synthetic legacy subscription is not readable')
  }
  await store.insertOrGet(draft('evt_disposable_legacy'))
  console.log('PASS legacy: legacy row is readable and intake insert succeeded')
}

const main = async () => {
  try {
    if (scenario === 'missing' || scenario === 'outage') {
      await expectFailure(scenario)
    } else if (scenario === 'success') {
      await verifySuccess()
    } else {
      await verifyLegacy()
    }
  } finally {
    await client.$disconnect()
  }
}

void main()
