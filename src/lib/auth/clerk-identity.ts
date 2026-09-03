import 'server-only'

import { auth } from '@clerk/nextjs'
import type { IdentityProvider } from './identity'

export const clerkIdentityProvider: IdentityProvider = async () => {
  const authState = await auth()
  return authState.userId ? { subject: authState.userId } : null
}
