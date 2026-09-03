import type { ProviderProfile } from '@/features/accounts/account-service'
import type { TeamIdentityProvider } from '@/features/team/team-service'
import type { IdentityProvider } from './identity'

type ClerkAuthState = {
  userId: string | null
}

type ClerkEmailAddress = {
  emailAddress: string
  id: string
  verification?: { status: string } | null
}

type ClerkUser = {
  emailAddresses: readonly ClerkEmailAddress[]
  firstName: string | null
  id: string
  imageUrl: string
  lastName: string | null
  primaryEmailAddressId: string | null
}

type ClerkInvitationClient = {
  invitations: {
    createInvitation: (values: {
      emailAddress: string
      publicMetadata: { throughInvitation: true }
      redirectUrl: string
    }) => Promise<{ id: string }>
    revokeInvitation: (providerInvitationId: string) => Promise<unknown>
  }
}

export const createClerkIdentityProvider = (
  getAuth: () => Promise<ClerkAuthState>
): IdentityProvider => async () => {
  const authState = await getAuth()
  return authState.userId ? { subject: authState.userId } : null
}

export const createClerkProfileProvider = (
  getCurrentUser: () => Promise<ClerkUser | null>
) => async (providerSubject: string): Promise<ProviderProfile | null> => {
  const user = await getCurrentUser()
  if (!user || user.id !== providerSubject) return null

  const primaryEmailRecord = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId
  )
  if (
    !primaryEmailRecord?.emailAddress ||
    primaryEmailRecord.verification?.status !== 'verified'
  ) {
    return null
  }

  const primaryEmail = primaryEmailRecord.emailAddress
  return {
    avatarUrl: user.imageUrl,
    email: primaryEmail,
    name:
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      primaryEmail,
    subject: user.id,
  }
}

export const createClerkInvitationProvider = (values: {
  getClient: () => Promise<ClerkInvitationClient>
  getRedirectUrl: () => string | undefined
}): TeamIdentityProvider => ({
  createInvitation: async (email) => {
    const redirectUrl = values.getRedirectUrl()
    if (!redirectUrl) throw new Error('NEXT_PUBLIC_URL is not configured')

    const client = await values.getClient()
    const invitation = await client.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { throughInvitation: true },
      redirectUrl,
    })
    return invitation.id
  },
  revokeInvitation: async (providerInvitationId) => {
    const client = await values.getClient()
    await client.invitations.revokeInvitation(providerInvitationId)
  },
})
