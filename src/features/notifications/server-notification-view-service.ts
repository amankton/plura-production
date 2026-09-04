import 'server-only'

import { Role } from '@prisma/client'
import { db } from '@/lib/db'
import {
  assertAgencyOperator,
} from '@/lib/auth/agency-context'
import { getAgencyContext } from '@/lib/auth/server-agency-context'
import { getTenantContext } from '@/lib/auth/server-tenant-context'
import {
  assertNotificationViewAction,
  createNotificationViewService,
} from './notification-view-service'

const store = {
  listAgencyNotifications: async ({
    agencyId,
    take,
  }: {
    agencyId: string
    take: 101
  }) => {
    const records = await db.notification.findMany({
      where: {
        agencyId,
        User: { agencyId },
        OR: [
          { subAccountId: null },
          { SubAccount: { agencyId } },
        ],
      },
      select: {
        agencyId: true,
        createdAt: true,
        id: true,
        notification: true,
        subAccountId: true,
        User: {
          select: {
            agencyId: true,
            avatarUrl: true,
            id: true,
            name: true,
            role: true,
          },
        },
        SubAccount: {
          select: {
            agencyId: true,
            id: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    })

    return records.map((record) => ({
      actor: {
        agencyId: record.User.agencyId,
        avatarUrl: record.User.avatarUrl,
        id: record.User.id,
        name: record.User.name,
        role: record.User.role,
      },
      agencyId: record.agencyId,
      createdAt: record.createdAt,
      id: record.id,
      message: record.notification,
      subaccount: record.SubAccount
        ? {
            agencyId: record.SubAccount.agencyId,
            id: record.SubAccount.id,
          }
        : null,
      subAccountId: record.subAccountId,
    }))
  },
  listSubaccountNotifications: async ({
    agencyId,
    subaccountId,
    take,
  }: {
    agencyId: string
    subaccountId: string
    take: 101
  }) => {
    const records = await db.notification.findMany({
      where: {
        agencyId,
        subAccountId: subaccountId,
        User: { agencyId },
        SubAccount: {
          agencyId,
          id: subaccountId,
        },
      },
      select: {
        agencyId: true,
        createdAt: true,
        id: true,
        notification: true,
        subAccountId: true,
        User: {
          select: {
            agencyId: true,
            avatarUrl: true,
            id: true,
            name: true,
            role: true,
          },
        },
        SubAccount: {
          select: {
            agencyId: true,
            id: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    })

    return records.map((record) => ({
      actor: {
        agencyId: record.User.agencyId,
        avatarUrl: record.User.avatarUrl,
        id: record.User.id,
        name: record.User.name,
        role: record.User.role,
      },
      agencyId: record.agencyId,
      createdAt: record.createdAt,
      id: record.id,
      message: record.notification,
      subaccount: record.SubAccount
        ? {
            agencyId: record.SubAccount.agencyId,
            id: record.SubAccount.id,
          }
        : null,
      subAccountId: record.subAccountId,
    }))
  },
}

const viewService = createNotificationViewService(store)

export const notificationViewService = Object.freeze({
  getAgencyFeed: async (requestedAgencyId: string) => {
    const action = 'notification:view-agency'
    const context = await getAgencyContext(requestedAgencyId)
    assertAgencyOperator(context)
    assertNotificationViewAction(context.actor.role, action)
    return viewService.getAgencyFeed(context)
  },
  getSubaccountFeed: async (requestedSubaccountId: string) => {
    const subaccountAction = 'notification:view-subaccount'
    const context = await getTenantContext(requestedSubaccountId)
    assertNotificationViewAction(context.actor.role, subaccountAction)
    if (
      context.actor.role === Role.AGENCY_OWNER ||
      context.actor.role === Role.AGENCY_ADMIN
    ) {
      const agencyAction = 'notification:view-agency'
      assertNotificationViewAction(context.actor.role, agencyAction)
      return viewService.getAgencyFeed(context)
    }
    return viewService.getSubaccountFeed(context)
  },
})
