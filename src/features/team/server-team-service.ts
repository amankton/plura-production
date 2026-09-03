import 'server-only'

import { clerkClient } from '@clerk/nextjs'
import { Prisma } from '@prisma/client'
import { AccessError } from '@/lib/auth/access-error'
import { clerkIdentityProvider } from '@/lib/auth/clerk-identity'
import { db } from '@/lib/db'
import {
  createTeamService,
  type TeamInvitationRecord,
  type TeamMemberRecord,
  type TeamPermissionRecord,
  type TeamStore,
} from './team-service'
import {
  assertManagedRoleTransition,
  assertScopedPermissionSnapshot,
  assertSingleMutation,
  buildMemberMutationWhere,
  buildPermissionMutationWhere,
} from './team-mutation-scope'

const permissionSelect = {
  access: true,
  id: true,
  SubAccount: {
    select: {
      agencyId: true,
      id: true,
      name: true,
    },
  },
} satisfies Prisma.PermissionsSelect

const memberSelect = {
  agencyId: true,
  avatarUrl: true,
  email: true,
  id: true,
  name: true,
  Permissions: { select: permissionSelect },
  role: true,
} satisfies Prisma.UserSelect

type PermissionResult = Prisma.PermissionsGetPayload<{
  select: typeof permissionSelect
}>
type MemberResult = Prisma.UserGetPayload<{ select: typeof memberSelect }>

const mapPermission = (permission: PermissionResult): TeamPermissionRecord => ({
  access: permission.access,
  id: permission.id,
  subaccount: {
    agencyId: permission.SubAccount?.agencyId ?? null,
    id: permission.SubAccount?.id ?? '',
    name: permission.SubAccount?.name ?? '',
  },
})

const mapMember = (member: MemberResult): TeamMemberRecord => ({
  agencyId: member.agencyId,
  avatarUrl: member.avatarUrl,
  email: member.email,
  id: member.id,
  name: member.name,
  permissions: member.Permissions.map(mapPermission),
  role: member.role,
})

const teamStore: TeamStore = {
  agencyExists: async (agencyId) =>
    Boolean(
      await db.agency.findUnique({
        where: { id: agencyId },
        select: { id: true },
      })
    ),
  createInvitation: async (values) => {
    const invitation = await db.invitation.create({ data: values })
    return invitation as TeamInvitationRecord
  },
  createPermission: async (values) =>
    mapPermission(
      await db.permissions.create({
        data: {
          access: values.access,
          email: values.email,
          subAccountId: values.subaccountId,
        },
        select: permissionSelect,
      })
    ),
  deleteMember: async (values) => {
    assertManagedRoleTransition(values.expectedRole, values.expectedRole)
    const result = await db.user.deleteMany({
      where: buildMemberMutationWhere(values),
    })
    assertSingleMutation(result.count)
  },
  findActorByProviderSubject: (providerSubject) =>
    db.user.findUnique({
      where: { id: providerSubject },
      select: { agencyId: true, id: true, role: true },
    }),
  findInvitationByEmail: async (email) => {
    const invitation = await db.invitation.findUnique({ where: { email } })
    return invitation as TeamInvitationRecord | null
  },
  findMemberByEmail: async (email) => {
    const member = await db.user.findUnique({
      where: { email },
      select: memberSelect,
    })
    return member ? mapMember(member) : null
  },
  findMemberById: async (memberId) => {
    const member = await db.user.findUnique({
      where: { id: memberId },
      select: memberSelect,
    })
    return member ? mapMember(member) : null
  },
  findPermissions: async (memberEmail, subaccountId) =>
    (
      await db.permissions.findMany({
        where: { email: memberEmail, subAccountId: subaccountId },
        select: permissionSelect,
      })
    ).map(mapPermission),
  findSubaccountById: (subaccountId) =>
    db.subAccount.findUnique({
      where: { id: subaccountId },
      select: { agencyId: true, id: true, name: true },
    }),
  listMembersByAgency: async (agencyId) =>
    (
      await db.user.findMany({
        where: { agencyId },
        orderBy: { name: 'asc' },
        take: 250,
        select: memberSelect,
      })
    ).map(mapMember),
  listSubaccountsByAgency: (agencyId) =>
    db.subAccount.findMany({
      where: { agencyId },
      orderBy: { name: 'asc' },
      take: 250,
      select: { agencyId: true, id: true, name: true },
    }),
  updateMemberProfile: async (memberId, values) =>
    mapMember(
      await db.user.update({
        where: { id: memberId },
        data: values,
        select: memberSelect,
      })
    ),
  updateMemberRole: (values) =>
    db.$transaction(
      async (transaction) => {
        assertManagedRoleTransition(values.expectedRole, values.nextRole)
        const target = await transaction.user.findFirst({
          where: buildMemberMutationWhere(values),
          select: memberSelect,
        })
        if (!target) throw new AccessError('CONFLICT')

        const mappedTarget = mapMember(target)
        assertScopedPermissionSnapshot(
          mappedTarget.permissions,
          values.agencyId
        )

        if (values.revokePermissions) {
          for (const permission of mappedTarget.permissions) {
            const result = await transaction.permissions.updateMany({
              where: buildPermissionMutationWhere({
                email: mappedTarget.email,
                expectedAccess: permission.access,
                permissionId: permission.id,
                subaccountId: permission.subaccount.id,
              }),
              data: { access: false },
            })
            assertSingleMutation(result.count)
          }
        }

        const updated = await transaction.user.updateMany({
          where: buildMemberMutationWhere(values),
          data: { role: values.nextRole },
        })
        assertSingleMutation(updated.count)

        const member = await transaction.user.findFirst({
          where: {
            agencyId: values.agencyId,
            id: values.memberId,
            role: values.nextRole,
          },
          select: memberSelect,
        })
        if (!member) throw new AccessError('CONFLICT')
        return mapMember(member)
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    ),
  updatePermission: async (values) => {
    const result = await db.permissions.updateMany({
      where: buildPermissionMutationWhere(values),
      data: { access: values.nextAccess },
    })
    assertSingleMutation(result.count)

    const permission = await db.permissions.findFirst({
      where: {
        email: values.email,
        id: values.permissionId,
        subAccountId: values.subaccountId,
      },
      select: permissionSelect,
    })
    if (!permission) throw new AccessError('CONFLICT')
    return mapPermission(permission)
  },
}

export const teamService = createTeamService({
  identityProvider: clerkIdentityProvider,
  provider: {
    createInvitation: async (email) => {
      const redirectUrl = process.env.NEXT_PUBLIC_URL
      if (!redirectUrl) throw new Error('NEXT_PUBLIC_URL is not configured')
      const invitation = await clerkClient.invitations.createInvitation({
        emailAddress: email,
        redirectUrl,
        publicMetadata: { throughInvitation: true },
      })
      return invitation.id
    },
    revokeInvitation: async (providerInvitationId) => {
      await clerkClient.invitations.revokeInvitation(providerInvitationId)
    },
  },
  store: teamStore,
})
