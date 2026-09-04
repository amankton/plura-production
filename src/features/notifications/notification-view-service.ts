import { Role } from '@prisma/client'
import { AccessError } from '@/lib/auth/access-error'
import type { AgencyContext } from '@/lib/auth/agency-context'
import type { TenantContext } from '@/lib/auth/tenant-context'

export type NotificationViewAction =
  | 'notification:view-agency'
  | 'notification:view-subaccount'

export type NotificationViewItem = Readonly<{
  actor: Readonly<{
    avatarUrl: string
    id: string
    name: string
    role: Role
  }>
  createdAt: string
  id: string
  message: string
  subAccountId: string | null
}>

export type NotificationViewProjection = Readonly<{
  notifications: readonly NotificationViewItem[]
  viewerRole: Role
}>

export type NotificationViewRecord = Readonly<{
  actor: Readonly<{
    agencyId: string | null
    avatarUrl: string
    id: string
    name: string
    role: Role
  }>
  agencyId: string
  createdAt: Date
  id: string
  message: string
  subaccount: Readonly<{
    agencyId: string
    id: string
  }> | null
  subAccountId: string | null
}>

export type NotificationViewStore = Readonly<{
  listAgencyNotifications: (input: Readonly<{
    agencyId: string
    take: 101
  }>) => Promise<readonly NotificationViewRecord[]>
  listSubaccountNotifications: (input: Readonly<{
    agencyId: string
    subaccountId: string
    take: 101
  }>) => Promise<readonly NotificationViewRecord[]>
}>

const maximumItems = 100
const sentinelTake = 101

const agencyRoles = new Set<Role>([
  Role.AGENCY_OWNER,
  Role.AGENCY_ADMIN,
])

const isRole = (value: unknown): value is Role =>
  value === Role.AGENCY_OWNER ||
  value === Role.AGENCY_ADMIN ||
  value === Role.SUBACCOUNT_USER ||
  value === Role.SUBACCOUNT_GUEST

const isAction = (value: unknown): value is NotificationViewAction =>
  value === 'notification:view-agency' ||
  value === 'notification:view-subaccount'

export function assertNotificationViewAction(
  role: unknown,
  action: unknown
): asserts role is Role {
  if (!isRole(role) || !isAction(action)) {
    throw new AccessError('FORBIDDEN')
  }
  if (action === 'notification:view-agency' && !agencyRoles.has(role)) {
    throw new AccessError('FORBIDDEN')
  }
}

const isBoundedText = (value: unknown, maximum: number) =>
  typeof value === 'string' &&
  value.length > 0 &&
  Array.from(value).length <= maximum

const isIdentifier = (value: unknown) => isBoundedText(value, 128)

const assertRecord = (
  record: NotificationViewRecord,
  agencyId: string,
  subaccountId?: string
) => {
  if (!record || typeof record !== 'object') {
    throw new AccessError('CONFLICT')
  }
  const actor = record.actor
  if (
    !actor ||
    typeof actor !== 'object' ||
    !isIdentifier(record.id) ||
    record.agencyId !== agencyId ||
    !isBoundedText(record.message, 1024) ||
    !(record.createdAt instanceof Date) ||
    Number.isNaN(record.createdAt.getTime()) ||
    !isIdentifier(actor.id) ||
    actor.agencyId !== agencyId ||
    !isBoundedText(actor.name, 256) ||
    !isBoundedText(actor.avatarUrl, 2048) ||
    !isRole(actor.role)
  ) {
    throw new AccessError('CONFLICT')
  }

  if (record.subAccountId === null) {
    if (record.subaccount !== null || subaccountId) {
      throw new AccessError('CONFLICT')
    }
    return
  }

  if (
    !isIdentifier(record.subAccountId) ||
    !record.subaccount ||
    record.subaccount.id !== record.subAccountId ||
    record.subaccount.agencyId !== agencyId ||
    (subaccountId !== undefined && record.subAccountId !== subaccountId)
  ) {
    throw new AccessError('CONFLICT')
  }
}

const assertOrder = (records: readonly NotificationViewRecord[]) => {
  for (let index = 1; index < records.length; index += 1) {
    const previous = records[index - 1]
    const current = records[index]
    const previousTime = previous.createdAt.getTime()
    const currentTime = current.createdAt.getTime()
    if (
      previousTime < currentTime ||
      (previousTime === currentTime && previous.id.localeCompare(current.id) < 0)
    ) {
      throw new AccessError('CONFLICT')
    }
  }
}

const mapRecords = (
  records: readonly NotificationViewRecord[],
  agencyId: string,
  subaccountId?: string
): readonly NotificationViewItem[] => {
  if (records.length > maximumItems) throw new AccessError('CONFLICT')

  const identifiers = new Set<string>()
  for (const record of records) {
    assertRecord(record, agencyId, subaccountId)
    if (identifiers.has(record.id)) throw new AccessError('CONFLICT')
    identifiers.add(record.id)
  }
  assertOrder(records)

  return records.map((record) => ({
    actor: {
      avatarUrl: record.actor.avatarUrl,
      id: record.actor.id,
      name: record.actor.name,
      role: record.actor.role,
    },
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    message: record.message,
    subAccountId: record.subAccountId,
  }))
}

export const createNotificationViewService = (store: NotificationViewStore) => ({
  getAgencyFeed: async (
    context: AgencyContext | TenantContext
  ): Promise<NotificationViewProjection> => {
    const records = await store.listAgencyNotifications({
      agencyId: context.agencyId,
      take: sentinelTake,
    })
    return {
      notifications: mapRecords(records, context.agencyId),
      viewerRole: context.actor.role,
    }
  },
  getSubaccountFeed: async (
    context: TenantContext
  ): Promise<NotificationViewProjection> => {
    const records = await store.listSubaccountNotifications({
      agencyId: context.agencyId,
      subaccountId: context.subaccountId,
      take: sentinelTake,
    })
    return {
      notifications: mapRecords(
        records,
        context.agencyId,
        context.subaccountId
      ),
      viewerRole: context.actor.role,
    }
  },
})
