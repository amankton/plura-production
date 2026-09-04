import { describe, expect, test } from 'bun:test'
import { Role } from '@prisma/client'
import { AccessError } from '@/lib/auth/access-error'
import type { AgencyContext } from '@/lib/auth/agency-context'
import type { TenantContext } from '@/lib/auth/tenant-context'
import {
  assertNotificationViewAction,
  createNotificationViewService,
  type NotificationViewRecord,
  type NotificationViewStore,
} from '@/features/notifications/notification-view-service'

const agencyId = 'agency-a'
const subaccountId = 'subaccount-a'

const agencyContext: AgencyContext = {
  actor: {
    id: 'actor-a',
    providerSubject: 'provider-a',
    role: Role.AGENCY_OWNER,
  },
  agencyId,
}

const tenantContext = (role: Role = Role.SUBACCOUNT_USER): TenantContext => ({
  actor: {
    id: 'actor-a',
    providerSubject: 'provider-a',
    role,
  },
  agencyId,
  correlationId: 'correlation-a',
  scope: { subaccountIds: [subaccountId] },
  subaccountId,
})

const record = (
  id: string,
  createdAt: Date,
  values: Partial<NotificationViewRecord> = {}
): NotificationViewRecord => ({
  actor: {
    agencyId,
    avatarUrl: 'https://example.test/avatar.png',
    id: 'actor-a',
    name: 'Actor',
    role: Role.AGENCY_OWNER,
  },
  agencyId,
  createdAt,
  id,
  message: 'Actor | updated a record',
  subaccount: {
    agencyId,
    id: subaccountId,
  },
  subAccountId: subaccountId,
  ...values,
})

const makeStore = (
  agencyRecords: readonly NotificationViewRecord[] = [],
  subaccountRecords: readonly NotificationViewRecord[] = agencyRecords
): NotificationViewStore => ({
  listAgencyNotifications: async () => agencyRecords,
  listSubaccountNotifications: async () => subaccountRecords,
})

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

describe('notification view action policy', () => {
  test('allows only the closed role and action matrix', () => {
    for (const role of [Role.AGENCY_OWNER, Role.AGENCY_ADMIN]) {
      expect(() =>
        assertNotificationViewAction(role, 'notification:view-agency')
      ).not.toThrow()
      expect(() =>
        assertNotificationViewAction(role, 'notification:view-subaccount')
      ).not.toThrow()
    }
    for (const role of [Role.SUBACCOUNT_USER, Role.SUBACCOUNT_GUEST]) {
      expect(() =>
        assertNotificationViewAction(role, 'notification:view-subaccount')
      ).not.toThrow()
      expect(() =>
        assertNotificationViewAction(role, 'notification:view-agency')
      ).toThrow(AccessError)
    }
    expect(() => assertNotificationViewAction('OWNER', 'notification:view-agency')).toThrow(
      AccessError
    )
    expect(() => assertNotificationViewAction(Role.AGENCY_OWNER, 'unknown')).toThrow(
      AccessError
    )
  })
})

describe('notification view service', () => {
  test('maps the exact bounded DTO and preserves deterministic order', async () => {
    const first = record('notification-b', new Date('2026-01-02T00:00:00.000Z'))
    const second = record('notification-a', new Date('2026-01-02T00:00:00.000Z'))
    const result = await createNotificationViewService(
      makeStore([first, second])
    ).getAgencyFeed(agencyContext)

    expect(result.viewerRole).toBe(Role.AGENCY_OWNER)
    expect(result.notifications.map((item) => item.id)).toEqual([
      'notification-b',
      'notification-a',
    ])
    expect(result.notifications[0]).toEqual({
      actor: {
        avatarUrl: 'https://example.test/avatar.png',
        id: 'actor-a',
        name: 'Actor',
        role: Role.AGENCY_OWNER,
      },
      createdAt: '2026-01-02T00:00:00.000Z',
      id: 'notification-b',
      message: 'Actor | updated a record',
      subAccountId: subaccountId,
    })
    expect(Object.keys(result.notifications[0]).sort()).toEqual([
      'actor',
      'createdAt',
      'id',
      'message',
      'subAccountId',
    ])
    expect(Object.keys(result.notifications[0].actor).sort()).toEqual([
      'avatarUrl',
      'id',
      'name',
      'role',
    ])
  })

  test('returns an empty array for an authorized empty feed', async () => {
    const result = await createNotificationViewService(
      makeStore()
    ).getSubaccountFeed(tenantContext())
    expect(result).toEqual({
      notifications: [],
      viewerRole: Role.SUBACCOUNT_USER,
    })
  })

  test('requests the 101-row sentinel with only resolved tenant selectors', async () => {
    const requests: unknown[] = []
    const store: NotificationViewStore = {
      listAgencyNotifications: async (request) => {
        requests.push(request)
        return []
      },
      listSubaccountNotifications: async (request) => {
        requests.push(request)
        return []
      },
    }
    const service = createNotificationViewService(store)
    await service.getAgencyFeed(agencyContext)
    await service.getSubaccountFeed(tenantContext())
    expect(requests).toEqual([
      { agencyId, take: 101 },
      { agencyId, subaccountId, take: 101 },
    ])
  })

  test('returns exactly 100 ordered items without silent truncation', async () => {
    const rows = Array.from({ length: 100 }, (_, index) =>
      record(
        `notification-${String(100 - index).padStart(3, '0')}`,
        new Date(1_800_000_000_000 - index)
      )
    )
    const result = await createNotificationViewService(
      makeStore(rows)
    ).getAgencyFeed(agencyContext)
    expect(result.notifications).toHaveLength(100)
    expect(result.notifications[0].id).toBe('notification-100')
    expect(result.notifications[99].id).toBe('notification-001')
  })

  test('fails closed for overflow, duplicates, and unstable ordering', async () => {
    const rows = Array.from({ length: 101 }, (_, index) =>
      record(
        `notification-${String(200 - index).padStart(3, '0')}`,
        new Date(1_800_000_000_000 - index)
      )
    )
    await expectAccessCode(
      createNotificationViewService(makeStore(rows)).getAgencyFeed(agencyContext),
      'CONFLICT'
    )

    const current = new Date('2026-01-02T00:00:00.000Z')
    const duplicate = [record('same', current), record('same', current)]
    await expectAccessCode(
      createNotificationViewService(makeStore(duplicate)).getAgencyFeed(
        agencyContext
      ),
      'CONFLICT'
    )

    const reversed = [
      record('notification-a', new Date('2026-01-01T00:00:00.000Z')),
      record('notification-b', new Date('2026-01-02T00:00:00.000Z')),
    ]
    await expectAccessCode(
      createNotificationViewService(makeStore(reversed)).getAgencyFeed(
        agencyContext
      ),
      'CONFLICT'
    )
  })

  test('rejects foreign and parent-mismatched rows without a partial feed', async () => {
    const timestamp = new Date('2026-01-02T00:00:00.000Z')
    const foreignActor = record('notification-b', timestamp, {
      actor: {
        agencyId: 'agency-foreign',
        avatarUrl: 'avatar',
        id: 'actor-foreign',
        name: 'Foreign',
        role: Role.SUBACCOUNT_USER,
      },
    })
    await expectAccessCode(
      createNotificationViewService(
        makeStore([record('notification-c', timestamp), foreignActor])
      ).getAgencyFeed(agencyContext),
      'CONFLICT'
    )

    const wrongSubaccount = record('notification-a', timestamp, {
      subaccount: { agencyId, id: 'subaccount-other' },
    })
    await expectAccessCode(
      createNotificationViewService(
        makeStore([], [wrongSubaccount])
      ).getSubaccountFeed(tenantContext()),
      'CONFLICT'
    )

    const otherSubaccount = record('notification-a', timestamp, {
      subaccount: { agencyId, id: 'subaccount-other' },
      subAccountId: 'subaccount-other',
    })
    await expectAccessCode(
      createNotificationViewService(
        makeStore([], [otherSubaccount])
      ).getSubaccountFeed(tenantContext()),
      'CONFLICT'
    )
  })

  test('rejects malformed dates and oversized display fields', async () => {
    await expectAccessCode(
      createNotificationViewService(
        makeStore([
          record('notification-a', new Date(Number.NaN)),
        ])
      ).getAgencyFeed(agencyContext),
      'CONFLICT'
    )
    await expectAccessCode(
      createNotificationViewService(
        makeStore([
          record('notification-a', new Date(), { message: 'x'.repeat(1025) }),
        ])
      ).getAgencyFeed(agencyContext),
      'CONFLICT'
    )
    await expectAccessCode(
      createNotificationViewService(
        makeStore([
          record('notification-a', new Date(), {
            actor: {
              agencyId,
              avatarUrl: 'x'.repeat(2049),
              id: 'actor-a',
              name: 'Actor',
              role: Role.AGENCY_OWNER,
            },
          }),
        ])
      ).getAgencyFeed(agencyContext),
      'CONFLICT'
    )

    const missingActor = record('notification-a', new Date())
    Reflect.deleteProperty(missingActor, 'actor')
    await expectAccessCode(
      createNotificationViewService(
        makeStore([missingActor])
      ).getAgencyFeed(agencyContext),
      'CONFLICT'
    )
  })
})
