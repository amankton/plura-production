import { Role } from '@prisma/client'
import { z } from 'zod'
import { AccessError } from '@/lib/auth/access-error'
import {
  requireProviderIdentity,
  type IdentityProvider,
} from '@/lib/auth/identity'

export type AccountUserRecord = {
  agencyId: string | null
  email: string
  id: string
  role: Role
}

export type AccountInvitationRecord = {
  agencyId: string
  email: string
  id: string
  role: Role
  status: 'ACCEPTED' | 'PENDING' | 'REVOKED'
}

export type ProviderProfile = {
  avatarUrl: string
  email: string
  name: string
  subject: string
}

export type AccountStore = {
  acceptInvitation: (values: {
    avatarUrl: string
    email: string
    invitationId: string
    name: string
    providerSubject: string
  }) => Promise<AccountUserRecord>
  createAgencyOwner: (values: {
    avatarUrl: string
    email: string
    name: string
    providerSubject: string
  }) => Promise<AccountUserRecord>
  findPendingInvitationByEmail: (
    email: string
  ) => Promise<AccountInvitationRecord | null>
  findUserByEmail: (email: string) => Promise<AccountUserRecord | null>
  findUserByProviderSubject: (
    providerSubject: string
  ) => Promise<AccountUserRecord | null>
}

type AccountServiceDependencies = {
  identityProvider: IdentityProvider
  profileProvider: (
    providerSubject: string
  ) => Promise<ProviderProfile | null>
  store: AccountStore
}

const profileSchema = z
  .object({
    avatarUrl: z.string().trim().url().max(2048),
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((email) => email.toLowerCase()),
    name: z.string().trim().min(1).max(120),
    subject: z.string().trim().min(1).max(128),
  })
  .strict()

const managedRoles = new Set<Role>([
  Role.AGENCY_ADMIN,
  Role.SUBACCOUNT_USER,
  Role.SUBACCOUNT_GUEST,
])

export const createAccountService = ({
  identityProvider,
  profileProvider,
  store,
}: AccountServiceDependencies) => {
  const resolveProfile = async () => {
    const identity = await requireProviderIdentity(identityProvider)
    const profile = profileSchema.parse(
      await profileProvider(identity.subject)
    )
    if (profile.subject !== identity.subject) {
      throw new AccessError('FORBIDDEN')
    }
    return profile
  }

  return {
    resolveAccountEntry: async () => {
      const identity = await requireProviderIdentity(identityProvider)
      const existing = await store.findUserByProviderSubject(identity.subject)
      if (existing) return existing.agencyId

      const profile = profileSchema.parse(
        await profileProvider(identity.subject)
      )
      if (profile.subject !== identity.subject) {
        throw new AccessError('FORBIDDEN')
      }

      const [invitation, emailOwner] = await Promise.all([
        store.findPendingInvitationByEmail(profile.email),
        store.findUserByEmail(profile.email),
      ])
      if (emailOwner) throw new AccessError('CONFLICT')
      if (!invitation) return null
      if (!managedRoles.has(invitation.role)) {
        throw new AccessError('CONFLICT')
      }

      const user = await store.acceptInvitation({
        avatarUrl: profile.avatarUrl,
        email: profile.email,
        invitationId: invitation.id,
        name: profile.name,
        providerSubject: profile.subject,
      })
      return user.agencyId
    },

    provisionAgencyOwner: async () => {
      const profile = await resolveProfile()
      const existing = await store.findUserByProviderSubject(profile.subject)
      if (existing) return existing

      const [invitation, emailOwner] = await Promise.all([
        store.findPendingInvitationByEmail(profile.email),
        store.findUserByEmail(profile.email),
      ])
      if (invitation || emailOwner) throw new AccessError('CONFLICT')

      const user = await store.createAgencyOwner({
        avatarUrl: profile.avatarUrl,
        email: profile.email,
        name: profile.name,
        providerSubject: profile.subject,
      })
      return user
    },
  }
}
