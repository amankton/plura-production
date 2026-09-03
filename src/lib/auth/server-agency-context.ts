import 'server-only'

import { db } from '@/lib/db'
import { clerkIdentityProvider } from './clerk-identity'
import {
  resolveAgencyContext,
  type AgencyRepository,
} from './agency-context'

const agencyRepository: AgencyRepository = {
  agencyExists: async (agencyId) =>
    Boolean(
      await db.agency.findUnique({
        where: { id: agencyId },
        select: { id: true },
      })
    ),
  findActorByProviderSubject: (providerSubject) =>
    db.user.findUnique({
      where: { id: providerSubject },
      select: { agencyId: true, id: true, role: true },
    }),
}

export const getAgencyContext = async (requestedAgencyId: string) =>
  resolveAgencyContext({
    identityProvider: clerkIdentityProvider,
    repository: agencyRepository,
    requestedAgencyId,
  })
