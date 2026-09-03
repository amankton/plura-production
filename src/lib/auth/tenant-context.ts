import { Role } from '@prisma/client'
import { AccessError } from './access-error'
import {
  requireProviderIdentity,
  type IdentityProvider,
} from './identity'

export type TenantPermissionRecord = {
  access: boolean
  agencyId: string | null
  subaccountId: string
}

export type TenantActorRecord = {
  agencyId: string | null
  id: string
  permissions: readonly TenantPermissionRecord[]
  role: Role
}

export type TenantSubaccountRecord = {
  agencyId: string
  id: string
}

export type TenantRepository = {
  findActorByProviderSubject: (
    providerSubject: string
  ) => Promise<TenantActorRecord | null>
  findSubaccountById: (
    subaccountId: string
  ) => Promise<TenantSubaccountRecord | null>
}

export type TenantContext = {
  actor: {
    id: string
    providerSubject: string
    role: Role
  }
  agencyId: string
  correlationId: string
  scope: {
    subaccountIds: readonly string[]
  }
  subaccountId: string
}

type ResolveTenantContextInput = {
  correlationId: string
  identityProvider: IdentityProvider
  repository: TenantRepository
  requestedSubaccountId: unknown
}

const privilegedRoles = new Set<Role>([
  Role.AGENCY_OWNER,
  Role.AGENCY_ADMIN,
])

export const resolveTenantContext = async ({
  correlationId,
  identityProvider,
  repository,
  requestedSubaccountId,
}: ResolveTenantContextInput): Promise<TenantContext> => {
  if (
    typeof requestedSubaccountId !== 'string' ||
    requestedSubaccountId.length > 128
  ) {
    throw new AccessError('FORBIDDEN')
  }

  const subaccountId = requestedSubaccountId.trim()
  if (!subaccountId) throw new AccessError('FORBIDDEN')

  const identity = await requireProviderIdentity(identityProvider)
  const [actor, subaccount] = await Promise.all([
    repository.findActorByProviderSubject(identity.subject),
    repository.findSubaccountById(subaccountId),
  ])

  if (!actor) {
    throw new AccessError('PROVISIONING_REQUIRED')
  }

  if (!actor.agencyId || !subaccount) {
    throw new AccessError('FORBIDDEN')
  }

  if (subaccount.agencyId !== actor.agencyId) {
    throw new AccessError('FORBIDDEN')
  }

  const relevantPermissions = actor.permissions.filter(
    (permission) => permission.subaccountId === subaccount.id
  )

  if (
    !privilegedRoles.has(actor.role) &&
    (relevantPermissions.length !== 1 ||
      !relevantPermissions[0].access ||
      relevantPermissions[0].agencyId !== actor.agencyId)
  ) {
    throw new AccessError('FORBIDDEN')
  }

  const permittedSubaccountIds = privilegedRoles.has(actor.role)
    ? [subaccount.id]
    : [relevantPermissions[0].subaccountId]

  return {
    actor: {
      id: actor.id,
      providerSubject: identity.subject,
      role: actor.role,
    },
    agencyId: actor.agencyId,
    correlationId,
    scope: {
      subaccountIds: Array.from(new Set(permittedSubaccountIds)),
    },
    subaccountId: subaccount.id,
  }
}
