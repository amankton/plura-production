import { Role } from '@prisma/client'
import { z } from 'zod'
import { AccessError } from '@/lib/auth/access-error'
import {
  requireProviderIdentity,
  type IdentityProvider,
} from '@/lib/auth/identity'

export type TeamActorRecord = {
  agencyId: string | null
  id: string
  role: Role
}

export type TeamPermissionRecord = {
  access: boolean
  id: string
  subaccount: {
    agencyId: string | null
    id: string
    name: string
  }
}

export type TeamMemberRecord = {
  agencyId: string | null
  avatarUrl: string
  email: string
  id: string
  name: string
  permissions: readonly TeamPermissionRecord[]
  role: Role
}

export type TeamSubaccountRecord = {
  agencyId: string
  id: string
  name: string
}

export type TeamInvitationRecord = {
  agencyId: string
  email: string
  id: string
  role: Role
  status: 'ACCEPTED' | 'PENDING' | 'REVOKED'
}

export type TeamView = {
  agencyId: string
  members: readonly TeamMemberRecord[]
  subaccounts: readonly TeamSubaccountRecord[]
}

type ProfileValues = {
  avatarUrl: string
  name: string
}

export type TeamStore = {
  agencyExists: (agencyId: string) => Promise<boolean>
  createInvitation: (values: {
    agencyId: string
    email: string
    role: Role
  }) => Promise<TeamInvitationRecord>
  createPermission: (values: {
    access: boolean
    email: string
    subaccountId: string
  }) => Promise<TeamPermissionRecord>
  deleteMember: (values: {
    agencyId: string
    expectedRole: Role
    memberId: string
  }) => Promise<void>
  findActorByProviderSubject: (
    providerSubject: string
  ) => Promise<TeamActorRecord | null>
  findInvitationByEmail: (
    email: string
  ) => Promise<TeamInvitationRecord | null>
  findMemberByEmail: (email: string) => Promise<TeamMemberRecord | null>
  findMemberById: (memberId: string) => Promise<TeamMemberRecord | null>
  findPermissions: (
    memberEmail: string,
    subaccountId: string
  ) => Promise<readonly TeamPermissionRecord[]>
  findSubaccountById: (
    subaccountId: string
  ) => Promise<TeamSubaccountRecord | null>
  listMembersByAgency: (
    agencyId: string
  ) => Promise<readonly TeamMemberRecord[]>
  listSubaccountsByAgency: (
    agencyId: string
  ) => Promise<readonly TeamSubaccountRecord[]>
  updateMemberProfile: (
    memberId: string,
    values: ProfileValues
  ) => Promise<TeamMemberRecord>
  updateMemberRole: (values: {
    agencyId: string
    expectedRole: Role
    memberId: string
    nextRole: Role
    revokePermissions: boolean
  }) => Promise<TeamMemberRecord>
  updatePermission: (values: {
    email: string
    expectedAccess: boolean
    nextAccess: boolean
    permissionId: string
    subaccountId: string
  }) => Promise<TeamPermissionRecord>
}

export type TeamIdentityProvider = {
  createInvitation: (email: string) => Promise<string>
  revokeInvitation: (providerInvitationId: string) => Promise<void>
}

type TeamServiceDependencies = {
  identityProvider: IdentityProvider
  provider: TeamIdentityProvider
  store: TeamStore
}

const identifierSchema = z.string().trim().min(1).max(128)
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((email) => email.toLowerCase())
const managedRoleSchema = z.enum([
  Role.AGENCY_ADMIN,
  Role.SUBACCOUNT_USER,
  Role.SUBACCOUNT_GUEST,
])

const agencySelectorSchema = identifierSchema
const targetSelectorSchema = z
  .object({ targetUserId: identifierSchema })
  .strict()
const invitationSchema = z
  .object({
    email: emailSchema,
    role: managedRoleSchema,
  })
  .strict()
const profileSchema = z
  .object({
    avatarUrl: z.string().trim().url().max(2048),
    name: z.string().trim().min(1).max(120),
  })
  .strict()
const roleChangeSchema = targetSelectorSchema.extend({
  role: managedRoleSchema,
})
const permissionSelectorSchema = targetSelectorSchema.extend({
  subaccountId: identifierSchema,
})

const assertOwner = (actor: TeamActorRecord) => {
  if (actor.role !== Role.AGENCY_OWNER) {
    throw new AccessError('FORBIDDEN')
  }
}

const assertSameAgencyTarget = (
  actor: TeamActorRecord & { agencyId: string },
  target: TeamMemberRecord | null
): TeamMemberRecord => {
  if (!target || target.agencyId !== actor.agencyId) {
    throw new AccessError('FORBIDDEN')
  }
  return target
}

const assertManagedTarget = (
  actor: TeamActorRecord & { agencyId: string },
  target: TeamMemberRecord | null
): TeamMemberRecord => {
  const member = assertSameAgencyTarget(actor, target)
  if (member.id === actor.id || member.role === Role.AGENCY_OWNER) {
    throw new AccessError('FORBIDDEN')
  }
  return member
}

const assertCleanPermissions = (
  permissions: readonly TeamPermissionRecord[],
  agencyId: string
) => {
  const seen = new Set<string>()
  for (const permission of permissions) {
    if (permission.subaccount.agencyId !== agencyId) {
      throw new AccessError('FORBIDDEN')
    }
    if (seen.has(permission.subaccount.id)) {
      throw new AccessError('CONFLICT')
    }
    seen.add(permission.subaccount.id)
  }
}

export const createTeamService = ({
  identityProvider,
  provider,
  store,
}: TeamServiceDependencies) => {
  const resolveActor = async (): Promise<TeamActorRecord & { agencyId: string }> => {
    const identity = await requireProviderIdentity(identityProvider)
    const actor = await store.findActorByProviderSubject(identity.subject)

    if (!actor) throw new AccessError('PROVISIONING_REQUIRED')
    if (!actor.agencyId) throw new AccessError('FORBIDDEN')

    return { ...actor, agencyId: actor.agencyId }
  }

  const resolveOwner = async () => {
    const actor = await resolveActor()
    assertOwner(actor)
    if (!(await store.agencyExists(actor.agencyId))) {
      throw new AccessError('FORBIDDEN')
    }
    return actor
  }

  const setPermission = async (
    rawInput: { subaccountId: string; targetUserId: string },
    access: boolean
  ) => {
    const input = permissionSelectorSchema.parse(rawInput)
    const actor = await resolveOwner()
    const [targetRecord, subaccount] = await Promise.all([
      store.findMemberById(input.targetUserId),
      store.findSubaccountById(input.subaccountId),
    ])
    const target = assertManagedTarget(actor, targetRecord)

    if (
      subaccount?.agencyId !== actor.agencyId ||
      (target.role !== Role.SUBACCOUNT_USER &&
        target.role !== Role.SUBACCOUNT_GUEST)
    ) {
      throw new AccessError('FORBIDDEN')
    }

    const permissions = await store.findPermissions(target.email, subaccount.id)
    if (permissions.length > 1) throw new AccessError('CONFLICT')
    if (permissions.length === 1) {
      const existing = permissions[0]
      if (existing.subaccount.agencyId !== actor.agencyId) {
        throw new AccessError('FORBIDDEN')
      }
      if (existing.access === access) return existing
      return store.updatePermission({
        email: target.email,
        expectedAccess: existing.access,
        nextAccess: access,
        permissionId: existing.id,
        subaccountId: subaccount.id,
      })
    }

    if (!access) return null
    return store.createPermission({
      access: true,
      email: target.email,
      subaccountId: subaccount.id,
    })
  }

  return {
    list: async (rawAgencyId: string): Promise<TeamView> => {
      const requestedAgencyId = agencySelectorSchema.parse(rawAgencyId)
      const actor = await resolveOwner()
      if (requestedAgencyId !== actor.agencyId) {
        throw new AccessError('FORBIDDEN')
      }

      const [members, subaccounts] = await Promise.all([
        store.listMembersByAgency(actor.agencyId),
        store.listSubaccountsByAgency(actor.agencyId),
      ])

      for (const member of members) {
        if (member.agencyId !== actor.agencyId) {
          throw new AccessError('FORBIDDEN')
        }
        assertCleanPermissions(member.permissions, actor.agencyId)
      }
      if (subaccounts.some((item) => item.agencyId !== actor.agencyId)) {
        throw new AccessError('FORBIDDEN')
      }

      return { agencyId: actor.agencyId, members, subaccounts }
    },

    getPermissions: async (rawInput: { targetUserId: string }) => {
      const input = targetSelectorSchema.parse(rawInput)
      const actor = await resolveOwner()
      const target = assertManagedTarget(
        actor,
        await store.findMemberById(input.targetUserId)
      )
      assertCleanPermissions(target.permissions, actor.agencyId)
      return { permissions: target.permissions }
    },

    getMember: async (rawInput: { targetUserId: string }) => {
      const input = targetSelectorSchema.parse(rawInput)
      const actor = await resolveOwner()
      const target = assertSameAgencyTarget(
        actor,
        await store.findMemberById(input.targetUserId)
      )
      assertCleanPermissions(target.permissions, actor.agencyId)
      return target
    },

    updateMyProfile: async (rawInput: ProfileValues) => {
      const input = profileSchema.parse(rawInput)
      const actor = await resolveActor()
      if (!(await store.agencyExists(actor.agencyId))) {
        throw new AccessError('FORBIDDEN')
      }
      return store.updateMemberProfile(actor.id, input)
    },

    changeRole: async (rawInput: {
      role: Role
      targetUserId: string
    }) => {
      const input = roleChangeSchema.parse(rawInput)
      const actor = await resolveOwner()
      const target = assertManagedTarget(
        actor,
        await store.findMemberById(input.targetUserId)
      )
      assertCleanPermissions(target.permissions, actor.agencyId)

      if (target.role === input.role) return target

      const crossesAdminBoundary =
        target.role === Role.AGENCY_ADMIN || input.role === Role.AGENCY_ADMIN
      return store.updateMemberRole({
        agencyId: actor.agencyId,
        expectedRole: target.role,
        memberId: target.id,
        nextRole: input.role,
        revokePermissions: crossesAdminBoundary,
      })
    },

    grantPermission: async (rawInput: {
      subaccountId: string
      targetUserId: string
    }) => setPermission(rawInput, true),

    revokePermission: async (rawInput: {
      subaccountId: string
      targetUserId: string
    }) => setPermission(rawInput, false),

    removeMember: async (rawInput: { targetUserId: string }) => {
      const input = targetSelectorSchema.parse(rawInput)
      const actor = await resolveOwner()
      const target = assertManagedTarget(
        actor,
        await store.findMemberById(input.targetUserId)
      )

      await store.deleteMember({
        agencyId: actor.agencyId,
        expectedRole: target.role,
        memberId: target.id,
      })
      return { id: target.id }
    },

    invite: async (rawInput: { email: string; role: Role }) => {
      const input = invitationSchema.parse(rawInput)
      const actor = await resolveOwner()
      const [member, existingInvitation] = await Promise.all([
        store.findMemberByEmail(input.email),
        store.findInvitationByEmail(input.email),
      ])

      if (member || existingInvitation) throw new AccessError('CONFLICT')

      const providerInvitationId = await provider.createInvitation(input.email)
      try {
        return await store.createInvitation({
          agencyId: actor.agencyId,
          email: input.email,
          role: input.role,
        })
      } catch (error) {
        try {
          await provider.revokeInvitation(providerInvitationId)
        } catch {
          throw new InvitationReconciliationError()
        }
        throw error
      }
    },
  }
}

export class InvitationReconciliationError extends Error {
  constructor() {
    super('Invitation reconciliation required')
    this.name = 'InvitationReconciliationError'
  }
}
