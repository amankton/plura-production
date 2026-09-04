import { describe, expect, test } from 'bun:test'
import { AccessError } from '@/lib/auth/access-error'
import {
  createActivityFoundationService,
  type ActivityEventDefinition,
  type ActivityFoundationStore,
} from '@/features/notifications/activity-foundation-service'

const event = 'FOUNDATION_VALIDATION_ONLY'

const input = {
  context: {
    actorId: 'actor-a',
    agencyId: 'agency-a',
    subaccountId: 'subaccount-a',
  },
  event,
  label: 'Record',
  receipt: {
    affectedRows: 1,
    agencyId: 'agency-a',
    operationId: 'operation-a',
    stale: false,
    subaccountId: 'subaccount-a',
  },
}

const registry: ReadonlyMap<string, ActivityEventDefinition> = new Map([
  [
    event,
    {
      render: (label: string | null) => `Updated ${label ?? 'record'}`,
      requiresLabel: true,
      scope: 'SUBACCOUNT',
    },
  ],
])

const expectAccessCode = async (
  operation: Promise<unknown>,
  code: AccessError['code']
) => {
  try {
    await operation
    throw new Error('Expected access error')
  } catch (error) {
    expect(error).toBeInstanceOf(AccessError)
    if (error instanceof AccessError) expect(error.code).toBe(code)
  }
}

describe('dormant activity foundation', () => {
  test('uses one test-owned template and one atomic fake write', async () => {
    const writes: unknown[] = []
    const store: ActivityFoundationStore = {
      createOnce: async (value) => {
        writes.push(value)
        return 'CREATED'
      },
    }
    const result = await createActivityFoundationService({ registry, store }).record(
      input
    )
    expect(result).toBe('CREATED')
    expect(writes).toEqual([
      {
        actorId: 'actor-a',
        agencyId: 'agency-a',
        event,
        message: 'Updated Record',
        operationId: 'operation-a',
        subaccountId: 'subaccount-a',
      },
    ])
  })

  test('preserves idempotent duplicate and rejects store conflict', async () => {
    const duplicateStore: ActivityFoundationStore = {
      createOnce: async () => 'DUPLICATE',
    }
    expect(
      await createActivityFoundationService({
        registry,
        store: duplicateStore,
      }).record(input)
    ).toBe('DUPLICATE')

    const conflictStore: ActivityFoundationStore = {
      createOnce: async () => 'CONFLICT',
    }
    await expectAccessCode(
      createActivityFoundationService({ registry, store: conflictStore }).record(
        input
      ),
      'CONFLICT'
    )
  })

  test('rejects unknown events, extra keys, and caller-authored authority', async () => {
    let writes = 0
    const store: ActivityFoundationStore = {
      createOnce: async () => {
        writes += 1
        return 'CREATED'
      },
    }
    const service = createActivityFoundationService({ registry, store })
    await expectAccessCode(
      service.record({ ...input, event: 'UNKNOWN' }),
      'FORBIDDEN'
    )
    await expectAccessCode(
      service.record({ ...input, description: 'forged' }),
      'FORBIDDEN'
    )
    for (const injected of [
      { actorId: 'forged' },
      { agencyId: 'forged' },
      { message: 'forged' },
      { payload: { secret: 'forged' } },
      { rawError: 'forged' },
      { role: 'AGENCY_OWNER' },
    ]) {
      await expectAccessCode(service.record({ ...input, ...injected }), 'FORBIDDEN')
    }
    await expectAccessCode(
      service.record({
        ...input,
        context: { ...input.context, email: 'actor@example.test' },
      }),
      'FORBIDDEN'
    )
    expect(writes).toBe(0)
  })

  test('rejects foreign, stale, zero-row, and malformed label inputs', async () => {
    let writes = 0
    const store: ActivityFoundationStore = {
      createOnce: async () => {
        writes += 1
        return 'CREATED'
      },
    }
    const service = createActivityFoundationService({ registry, store })
    await expectAccessCode(
      service.record({
        ...input,
        receipt: { ...input.receipt, agencyId: 'agency-foreign' },
      }),
      'CONFLICT'
    )
    await expectAccessCode(
      service.record({
        ...input,
        receipt: { ...input.receipt, subaccountId: 'subaccount-foreign' },
      }),
      'CONFLICT'
    )
    await expectAccessCode(
      service.record({
        ...input,
        context: {
          agencyId: input.context.agencyId,
          subaccountId: input.context.subaccountId,
        },
      }),
      'FORBIDDEN'
    )
    await expectAccessCode(
      service.record({
        ...input,
        receipt: { ...input.receipt, stale: true },
      }),
      'CONFLICT'
    )
    await expectAccessCode(
      service.record({
        ...input,
        receipt: { ...input.receipt, affectedRows: 0 },
      }),
      'CONFLICT'
    )
    await expectAccessCode(
      service.record({
        ...input,
        receipt: { ...input.receipt, affectedRows: 2 },
      }),
      'CONFLICT'
    )
    for (const label of ['x'.repeat(129), 'bad|label', 'bad\nlabel', 'bad\u0000label']) {
      await expectAccessCode(service.record({ ...input, label }), 'CONFLICT')
    }
    expect(writes).toBe(0)
  })

  test('surfaces rollback without retaining a fake write', async () => {
    const writes: unknown[] = []
    const store: ActivityFoundationStore = {
      createOnce: async () => {
        throw new Error('rollback')
      },
    }
    await expectAccessCode(
      createActivityFoundationService({ registry, store }).record(input),
      'CONFLICT'
    )
    expect(writes).toEqual([])
  })

  test('contains renderer failures and rejects unknown adapter outcomes', async () => {
    let writes = 0
    const store: ActivityFoundationStore = {
      createOnce: async () => {
        writes += 1
        return 'CREATED'
      },
    }
    const failingRegistry: ReadonlyMap<string, ActivityEventDefinition> = new Map([
      [
        event,
        {
          render: () => {
            throw new Error('template-detail')
          },
          requiresLabel: true,
          scope: 'SUBACCOUNT',
        },
      ],
    ])
    await expectAccessCode(
      createActivityFoundationService({
        registry: failingRegistry,
        store,
      }).record(input),
      'CONFLICT'
    )
    expect(writes).toBe(0)

    const unknownResultStore: ActivityFoundationStore = {
      createOnce: async () => 'CREATED',
    }
    Reflect.set(unknownResultStore, 'createOnce', async () => 'UNREVIEWED')
    await expectAccessCode(
      createActivityFoundationService({
        registry,
        store: unknownResultStore,
      }).record(input),
      'CONFLICT'
    )
  })
})
