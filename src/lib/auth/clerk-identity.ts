import 'server-only'

import { auth } from '@clerk/nextjs/server'
import { createClerkIdentityProvider } from './clerk-adapters'

export const clerkIdentityProvider = createClerkIdentityProvider(auth)
