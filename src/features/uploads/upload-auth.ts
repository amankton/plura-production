import {
  requireProviderIdentity,
  type IdentityProvider,
} from '@/lib/auth/identity'

export const getAuthenticatedUploadMetadata = async (
  identityProvider: IdentityProvider
) => {
  const identity = await requireProviderIdentity(identityProvider)
  return { userId: identity.subject }
}
