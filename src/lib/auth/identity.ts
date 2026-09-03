import { AccessError } from './access-error'

export type ProviderIdentity = {
  subject: string
}

export type IdentityProvider = () => Promise<ProviderIdentity | null>

export const requireProviderIdentity = async (
  identityProvider: IdentityProvider
): Promise<ProviderIdentity> => {
  const identity = await identityProvider()
  const subject =
    typeof identity?.subject === 'string' ? identity.subject.trim() : ''

  if (!subject) {
    throw new AccessError('UNAUTHENTICATED')
  }

  return { subject }
}
