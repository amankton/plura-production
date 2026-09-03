import { Role } from '@prisma/client'
import { AccessError } from './access-error'
import {
  requireProviderIdentity,
  type IdentityProvider,
} from './identity'

export type AgencyActorRecord = {
  agencyId: string | null
  id: string
  role: Role
}

export type AgencyRepository = {
  findActorByProviderSubject: (
    providerSubject: string
  ) => Promise<AgencyActorRecord | null>
  agencyExists: (agencyId: string) => Promise<boolean>
}

export type AgencyContext = {
  actor: {
    id: string
    providerSubject: string
    role: Role
  }
  agencyId: string
}

type ResolveAgencyContextInput = {
  identityProvider: IdentityProvider
  repository: AgencyRepository
  requestedAgencyId: unknown
}

export const resolveAgencyContext = async ({
  identityProvider,
  repository,
  requestedAgencyId,
}: ResolveAgencyContextInput): Promise<AgencyContext> => {
  if (
    typeof requestedAgencyId !== 'string' ||
    !requestedAgencyId.trim() ||
    requestedAgencyId.length > 128
  ) {
    throw new AccessError('FORBIDDEN')
  }

  const agencyId = requestedAgencyId.trim()
  const identity = await requireProviderIdentity(identityProvider)
  const actor = await repository.findActorByProviderSubject(identity.subject)

  if (!actor) throw new AccessError('PROVISIONING_REQUIRED')
  if (!actor.agencyId || actor.agencyId !== agencyId) {
    throw new AccessError('FORBIDDEN')
  }
  if (!(await repository.agencyExists(agencyId))) {
    throw new AccessError('FORBIDDEN')
  }

  return {
    actor: {
      id: actor.id,
      providerSubject: identity.subject,
      role: actor.role,
    },
    agencyId,
  }
}

export const assertAgencyOwner = (context: AgencyContext) => {
  if (context.actor.role !== Role.AGENCY_OWNER) {
    throw new AccessError('FORBIDDEN')
  }
}

export const assertAgencyOperator = (context: AgencyContext) => {
  if (
    context.actor.role !== Role.AGENCY_OWNER &&
    context.actor.role !== Role.AGENCY_ADMIN
  ) {
    throw new AccessError('FORBIDDEN')
  }
}
