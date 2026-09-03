import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { UploadThingError } from 'uploadthing/server'
import { clerkIdentityProvider } from '@/lib/auth/clerk-identity'
import { getAuthenticatedUploadMetadata } from '@/features/uploads/upload-auth'

const f = createUploadthing()

const authenticateUser = async () => {
  try {
    return await getAuthenticatedUploadMetadata(clerkIdentityProvider)
  } catch {
    throw new UploadThingError('Unauthorized')
  }
}

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  subaccountLogo: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(authenticateUser)
    .onUploadComplete(() => {}),
  avatar: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(authenticateUser)
    .onUploadComplete(() => {}),
  agencyLogo: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(authenticateUser)
    .onUploadComplete(() => {}),
  media: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(authenticateUser)
    .onUploadComplete(() => {}),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
