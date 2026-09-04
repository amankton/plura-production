import 'server-only'

import { Prisma, Role } from '@prisma/client'
import { clerkIdentityProvider } from '@/lib/auth/clerk-identity'
import { getAgencyContext } from '@/lib/auth/server-agency-context'
import { getTenantContext } from '@/lib/auth/server-tenant-context'
import { db } from '@/lib/db'
import {
  createProjectionService,
  type ProjectionStore,
  type TicketAssigneeRecord,
} from './projection-service'

const agencyNavigationSelect = {
  address: true,
  agencyLogo: true,
  id: true,
  name: true,
  whiteLabel: true,
} satisfies Prisma.AgencySelect

const subaccountNavigationSelect = {
  address: true,
  id: true,
  name: true,
  subAccountLogo: true,
} satisfies Prisma.SubAccountSelect

const projectionStore: ProjectionStore = {
  listActorProfiles: (values) =>
    db.user.findMany({
      where: { agencyId: values.agencyId, id: values.actorId },
      select: {
        avatarUrl: true,
        email: true,
        id: true,
        name: true,
        role: true,
      },
      take: 2,
    }),
  listActorsByProviderSubject: (providerSubject) =>
    db.user.findMany({
      where: { id: providerSubject },
      select: { agencyId: true, id: true, role: true },
      take: 2,
    }),
  listAgencyNavigations: (agencyId) =>
    db.agency.findMany({
      where: { id: agencyId },
      select: agencyNavigationSelect,
      take: 2,
    }),
  listAgencyProfiles: (agencyId) =>
    db.agency.findMany({
      where: { id: agencyId },
      select: {
        address: true,
        agencyLogo: true,
        city: true,
        companyEmail: true,
        companyPhone: true,
        country: true,
        goal: true,
        id: true,
        name: true,
        state: true,
        whiteLabel: true,
        zipCode: true,
      },
      take: 2,
    }),
  listAgencyReferences: (agencyId) =>
    db.agency.findMany({
      where: { id: agencyId },
      select: { id: true },
      take: 2,
    }),
  listAgencySidebarOptions: (agencyId) =>
    db.agencySidebarOption.findMany({
      where: { agencyId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        createdAt: true,
        icon: true,
        id: true,
        link: true,
        name: true,
      },
      take: 250,
    }),
  listAgencySubaccounts: (agencyId) =>
    db.subAccount.findMany({
      where: { agencyId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        address: true,
        agencyId: true,
        id: true,
        name: true,
        subAccountLogo: true,
      },
      take: 250,
    }),
  listDefaultRedirectPermissions: async (values) =>
    (
      await db.permissions.findMany({
        where: {
          access: true,
          SubAccount: { agencyId: values.agencyId },
          User: { agencyId: values.agencyId, id: values.actorId },
        },
        orderBy: { subAccountId: 'asc' },
        select: {
          access: true,
          subAccountId: true,
          SubAccount: { select: { agencyId: true } },
        },
        take: 250,
      })
    ).map((permission) => ({
      access: permission.access,
      subaccountAgencyId: permission.SubAccount.agencyId,
      subaccountId: permission.subAccountId,
    })),
  listLegacyActorNames: (values) =>
    db.user.findMany({
      where: { agencyId: values.agencyId, id: values.actorId },
      select: { name: true },
      take: 2,
    }),
  listPermittedSubaccounts: async (values) =>
    (
      await db.permissions.findMany({
        where: {
          access: true,
          SubAccount: { agencyId: values.agencyId },
          User: { agencyId: values.agencyId, id: values.actorId },
        },
        orderBy: [{ subAccountId: 'asc' }, { id: 'asc' }],
        select: {
          access: true,
          id: true,
          SubAccount: {
            select: {
              address: true,
              agencyId: true,
              id: true,
              name: true,
              subAccountLogo: true,
            },
          },
        },
        take: 250,
      })
    ).map((permission) => ({
      access: permission.access,
      permissionId: permission.id,
      subaccount: permission.SubAccount,
    })),
  listSubaccountDetails: (values) =>
    db.subAccount.findMany({
      where: { agencyId: values.agencyId, id: values.subaccountId },
      select: {
        address: true,
        agencyId: true,
        city: true,
        companyEmail: true,
        companyPhone: true,
        country: true,
        id: true,
        name: true,
        state: true,
        subAccountLogo: true,
        zipCode: true,
      },
      take: 2,
    }),
  listSubaccountNavigations: (values) =>
    db.subAccount.findMany({
      where: { agencyId: values.agencyId, id: values.subaccountId },
      select: {
        address: true,
        agencyId: true,
        id: true,
        name: true,
        subAccountLogo: true,
      },
      take: 2,
    }),
  listSubaccountSidebarOptions: (values) =>
    db.subAccountSidebarOption.findMany({
      where: {
        subAccountId: values.subaccountId,
        SubAccount: { agencyId: values.agencyId },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        createdAt: true,
        icon: true,
        id: true,
        link: true,
        name: true,
      },
      take: 250,
    }),
  listTicketAssignees: async (values) =>
    (
      await db.permissions.findMany({
        where: {
          access: true,
          subAccountId: values.subaccountId,
          SubAccount: { agencyId: values.agencyId },
          User: {
            agencyId: values.agencyId,
            role: Role.SUBACCOUNT_USER,
          },
        },
        orderBy: [{ User: { name: 'asc' } }, { id: 'asc' }],
        select: {
          id: true,
          SubAccount: { select: { agencyId: true } },
          User: {
            select: {
              agencyId: true,
              avatarUrl: true,
              id: true,
              name: true,
              role: true,
            },
          },
        },
        take: 250,
      })
    ).map(
      (permission): TicketAssigneeRecord => ({
        avatarUrl: permission.User.avatarUrl,
        id: permission.User.id,
        name: permission.User.name,
        permissionId: permission.id,
        role: permission.User.role,
        subaccountAgencyId: permission.SubAccount.agencyId,
        userAgencyId: permission.User.agencyId,
      })
    ),
}

export const agencyProjectionService = createProjectionService({
  identityProvider: clerkIdentityProvider,
  resolveAgencyContext: getAgencyContext,
  resolveTenantContext: getTenantContext,
  store: projectionStore,
})
