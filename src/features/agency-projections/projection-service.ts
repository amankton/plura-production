import { Role, type Icon } from '@prisma/client'
import { AccessError } from '@/lib/auth/access-error'
import {
  assertAgencyOperator,
  type AgencyContext,
} from '@/lib/auth/agency-context'
import {
  requireProviderIdentity,
  type IdentityProvider,
} from '@/lib/auth/identity'
import type { TenantContext } from '@/lib/auth/tenant-context'

export type AgencyNavigation = Readonly<{
  address: string
  agencyLogo: string
  id: string
  name: string
  whiteLabel: boolean
}>

export type SubaccountNavigation = Readonly<{
  address: string
  id: string
  name: string
  subAccountLogo: string
}>

export type SidebarOption = Readonly<{
  icon: Icon
  id: string
  link: string
  name: string
}>

export type ActorNavigation = Readonly<{ role: Role }>

export type AgencyProfile = Readonly<{
  address: string
  agencyLogo: string
  city: string
  companyEmail: string
  companyPhone: string
  country: string
  goal: number
  id: string
  name: string
  state: string
  whiteLabel: boolean
  zipCode: string
}>

export type SubaccountDetails = Readonly<{
  address: string
  city: string
  companyEmail: string
  companyPhone: string
  country: string
  id: string
  name: string
  state: string
  subAccountLogo: string
  zipCode: string
}>

export type ActorProfile = Readonly<{
  avatarUrl: string
  email: string
  id: string
  name: string
  role: Role
}>

export type SubaccountSelector = Readonly<{ id: string; name: string }>

export type TicketAssigneeOption = Readonly<{
  avatarUrl: string
  id: string
  name: string
}>

export type AccountEntryProjection =
  | Readonly<{ agencyId: string; kind: 'ROUTE'; role: Role }>
  | Readonly<{ kind: 'ONBOARDING' }>

export type AgencySidebarProjection = Readonly<{
  actor: ActorNavigation
  agency: AgencyNavigation
  kind: 'agency'
  sidebarOptions: readonly SidebarOption[]
  subaccounts: readonly SubaccountNavigation[]
}>

export type SubaccountSidebarProjection = Readonly<{
  actor: ActorNavigation
  agency: AgencyNavigation
  currentSubaccount: SubaccountNavigation
  kind: 'subaccount'
  sidebarOptions: readonly SidebarOption[]
  subaccounts: readonly SubaccountNavigation[]
}>

export type AgencySubaccountsProjection = Readonly<{
  agency: Readonly<{ id: string }>
  subaccounts: readonly SubaccountNavigation[]
}>

export type AgencySettingsProjection = Readonly<{
  actor: ActorProfile
  agency: AgencyProfile
  subaccounts: readonly SubaccountSelector[]
}>

export type SubaccountSettingsProjection = Readonly<{
  actor: ActorProfile
  agency: Readonly<{ id: string }>
  details: SubaccountDetails
  subaccounts: readonly SubaccountSelector[]
}>

export type ProjectionActorRecord = Readonly<{
  agencyId: string | null
  id: string
  role: Role
}>

export type DefaultRedirectPermissionRecord = Readonly<{
  access: boolean
  subaccountAgencyId: string
  subaccountId: string
}>

export type SidebarOptionRecord = SidebarOption &
  Readonly<{ createdAt: Date }>

export type PermittedSubaccountRecord = Readonly<{
  access: boolean
  permissionId: string
  subaccount: SubaccountNavigation & Readonly<{ agencyId: string }>
}>

export type AgencySubaccountRecord = SubaccountNavigation &
  Readonly<{ agencyId: string }>

export type AgencySubaccountSelectorRecord = SubaccountSelector &
  Readonly<{ agencyId: string }>

export type PermittedSubaccountSelectorRecord = Readonly<{
  access: boolean
  permissionId: string
  subaccount: AgencySubaccountSelectorRecord
}>

export type SubaccountDetailsRecord = SubaccountDetails &
  Readonly<{ agencyId: string }>

export type TicketAssigneeRecord = TicketAssigneeOption &
  Readonly<{
    permissionId: string
    role: Role
    subaccountAgencyId: string
    userAgencyId: string | null
  }>

export type TicketAssigneeSetRecord = Readonly<{
  agencyId: string
  assignees: readonly TicketAssigneeRecord[]
  id: string
}>

export type ProjectionStore = {
  listActorProfiles: (values: {
    actorId: string
    agencyId: string
  }) => Promise<readonly ActorProfile[]>
  listActorsByProviderSubject: (
    providerSubject: string
  ) => Promise<readonly ProjectionActorRecord[]>
  listAgencyNavigations: (
    agencyId: string
  ) => Promise<readonly AgencyNavigation[]>
  listAgencyProfiles: (agencyId: string) => Promise<readonly AgencyProfile[]>
  listAgencyReferences: (
    agencyId: string
  ) => Promise<readonly Readonly<{ id: string }>[]>
  listAgencySidebarOptions: (
    agencyId: string
  ) => Promise<readonly SidebarOptionRecord[]>
  listAgencySubaccounts: (
    agencyId: string
  ) => Promise<readonly AgencySubaccountRecord[]>
  listAgencySubaccountSelectors: (
    agencyId: string
  ) => Promise<readonly AgencySubaccountSelectorRecord[]>
  listDefaultRedirectPermissions: (values: {
    actorId: string
    agencyId: string
  }) => Promise<readonly DefaultRedirectPermissionRecord[]>
  listPermittedSubaccounts: (values: {
    actorId: string
    agencyId: string
  }) => Promise<readonly PermittedSubaccountRecord[]>
  listPermittedSubaccountSelectors: (values: {
    actorId: string
    agencyId: string
  }) => Promise<readonly PermittedSubaccountSelectorRecord[]>
  listSubaccountDetails: (values: {
    agencyId: string
    subaccountId: string
  }) => Promise<readonly SubaccountDetailsRecord[]>
  listSubaccountNavigations: (values: {
    agencyId: string
    subaccountId: string
  }) => Promise<readonly AgencySubaccountRecord[]>
  listSubaccountSidebarOptions: (values: {
    agencyId: string
    subaccountId: string
  }) => Promise<readonly SidebarOptionRecord[]>
  listTicketAssigneeSets: (values: {
    agencyId: string
    subaccountId: string
  }) => Promise<readonly TicketAssigneeSetRecord[]>
}

type ProjectionServiceDependencies = {
  identityProvider: IdentityProvider
  resolveAgencyContext: (agencyId: string) => Promise<AgencyContext>
  resolveTenantContext: (subaccountId: string) => Promise<TenantContext>
  store: ProjectionStore
}

const privilegedRoles = new Set<Role>([
  Role.AGENCY_OWNER,
  Role.AGENCY_ADMIN,
])
const roles = new Set<Role>(Object.values(Role))
const maximumProjectionListSize = 250

const parseSelector = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 128) {
    throw new AccessError('FORBIDDEN')
  }
  const parsed = value.trim()
  if (!parsed) throw new AccessError('FORBIDDEN')
  return parsed
}

const exactlyOne = <T>(records: readonly T[]): T => {
  if (records.length !== 1) {
    throw new AccessError(records.length > 1 ? 'CONFLICT' : 'FORBIDDEN')
  }
  return records[0]
}

const withinProjectionLimit = <T>(records: readonly T[]): readonly T[] => {
  if (records.length > maximumProjectionListSize) {
    throw new AccessError('CONFLICT')
  }
  return records
}

const compareByNameAndId = (
  left: Readonly<{ id: string; name: string }>,
  right: Readonly<{ id: string; name: string }>
) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)

const compareById = (
  left: Readonly<{ id: string }>,
  right: Readonly<{ id: string }>
) => left.id.localeCompare(right.id)

const mapSidebarOption = (option: SidebarOptionRecord): SidebarOption => ({
  icon: option.icon,
  id: option.id,
  link: option.link,
  name: option.name,
})

const mapAgencyNavigation = (
  agency: AgencyNavigation
): AgencyNavigation => ({
  address: agency.address,
  agencyLogo: agency.agencyLogo,
  id: agency.id,
  name: agency.name,
  whiteLabel: agency.whiteLabel,
})

const mapAgencyProfile = (agency: AgencyProfile): AgencyProfile => ({
  address: agency.address,
  agencyLogo: agency.agencyLogo,
  city: agency.city,
  companyEmail: agency.companyEmail,
  companyPhone: agency.companyPhone,
  country: agency.country,
  goal: agency.goal,
  id: agency.id,
  name: agency.name,
  state: agency.state,
  whiteLabel: agency.whiteLabel,
  zipCode: agency.zipCode,
})

const mapActorProfile = (actor: ActorProfile): ActorProfile => ({
  avatarUrl: actor.avatarUrl,
  email: actor.email,
  id: actor.id,
  name: actor.name,
  role: actor.role,
})

const mapAgencyReference = (
  agency: Readonly<{ id: string }>
): Readonly<{ id: string }> => ({ id: agency.id })

const mapSubaccountNavigation = (
  subaccount: AgencySubaccountRecord
): SubaccountNavigation => ({
  address: subaccount.address,
  id: subaccount.id,
  name: subaccount.name,
  subAccountLogo: subaccount.subAccountLogo,
})

const assertDistinct = <T>(
  records: readonly T[],
  key: (record: T) => string
) => {
  const seen = new Set<string>()
  for (const record of records) {
    const value = key(record)
    if (seen.has(value)) throw new AccessError('CONFLICT')
    seen.add(value)
  }
}

export const createProjectionService = ({
  identityProvider,
  resolveAgencyContext,
  resolveTenantContext,
  store,
}: ProjectionServiceDependencies) => {
  const getVisibleSubaccounts = async (context: TenantContext) => {
    if (privilegedRoles.has(context.actor.role)) {
      const subaccounts = withinProjectionLimit(
        await store.listAgencySubaccounts(context.agencyId)
      )
      if (
        subaccounts.some(
          (subaccount) => subaccount.agencyId !== context.agencyId
        )
      ) {
        throw new AccessError('FORBIDDEN')
      }
      return subaccounts
        .slice()
        .sort(compareByNameAndId)
        .map(mapSubaccountNavigation)
    }

    const permissions = withinProjectionLimit(
      await store.listPermittedSubaccounts({
        actorId: context.actor.id,
        agencyId: context.agencyId,
      })
    )
    assertDistinct(permissions, (permission) => permission.subaccount.id)
    for (const permission of permissions) {
      if (
        !permission.access ||
        permission.subaccount.agencyId !== context.agencyId
      ) {
        throw new AccessError('FORBIDDEN')
      }
    }
    return permissions
      .map((permission): SubaccountNavigation => ({
        address: permission.subaccount.address,
        id: permission.subaccount.id,
        name: permission.subaccount.name,
        subAccountLogo: permission.subaccount.subAccountLogo,
      }))
      .sort(compareByNameAndId)
  }

  const getVisibleSubaccountSelectors = async (context: TenantContext) => {
    if (privilegedRoles.has(context.actor.role)) {
      const subaccounts = withinProjectionLimit(
        await store.listAgencySubaccountSelectors(context.agencyId)
      )
      if (
        subaccounts.some(
          (subaccount) => subaccount.agencyId !== context.agencyId
        )
      ) {
        throw new AccessError('FORBIDDEN')
      }
      return subaccounts
        .map(({ id, name }) => ({ id, name }))
        .sort(compareByNameAndId)
    }

    const permissions = withinProjectionLimit(
      await store.listPermittedSubaccountSelectors({
        actorId: context.actor.id,
        agencyId: context.agencyId,
      })
    )
    assertDistinct(permissions, (permission) => permission.subaccount.id)
    for (const permission of permissions) {
      if (
        !permission.access ||
        permission.subaccount.agencyId !== context.agencyId
      ) {
        throw new AccessError('FORBIDDEN')
      }
    }
    return permissions
      .map(({ subaccount: { id, name } }) => ({ id, name }))
      .sort(compareByNameAndId)
  }

  return {
    getAccountEntryProjection: async (): Promise<AccountEntryProjection> => {
      const identity = await requireProviderIdentity(identityProvider)
      const actors = await store.listActorsByProviderSubject(identity.subject)
      if (actors.length > 1) throw new AccessError('CONFLICT')
      if (actors.length === 0) return { kind: 'ONBOARDING' }

      const actor = actors[0]
      if (actor.id !== identity.subject || !roles.has(actor.role)) {
        throw new AccessError('FORBIDDEN')
      }
      if (!actor.agencyId) {
        if (actor.role === Role.AGENCY_OWNER) return { kind: 'ONBOARDING' }
        throw new AccessError('FORBIDDEN')
      }

      return {
        agencyId: actor.agencyId,
        kind: 'ROUTE',
        role: actor.role,
      }
    },

    getDefaultSubaccountRedirectProjection: async (): Promise<
      Readonly<{ subaccountId: string }>
    > => {
      const identity = await requireProviderIdentity(identityProvider)
      const actor = exactlyOne(
        await store.listActorsByProviderSubject(identity.subject)
      )
      if (actor.id !== identity.subject || !roles.has(actor.role)) {
        throw new AccessError('FORBIDDEN')
      }
      if (!actor.agencyId) throw new AccessError('FORBIDDEN')

      const permissions = await store.listDefaultRedirectPermissions({
        actorId: actor.id,
        agencyId: actor.agencyId,
      })
      withinProjectionLimit(permissions)
      if (permissions.length === 0) throw new AccessError('FORBIDDEN')
      assertDistinct(permissions, (permission) => permission.subaccountId)
      for (const permission of permissions) {
        if (
          !permission.access ||
          permission.subaccountAgencyId !== actor.agencyId
        ) {
          throw new AccessError('FORBIDDEN')
        }
      }
      const first = permissions.slice().sort((left, right) =>
        left.subaccountId.localeCompare(right.subaccountId)
      )[0]
      return { subaccountId: first.subaccountId }
    },

    getAgencySidebarProjection: async (
      rawAgencyId: unknown
    ): Promise<AgencySidebarProjection> => {
      const agencyId = parseSelector(rawAgencyId)
      const context = await resolveAgencyContext(agencyId)
      assertAgencyOperator(context)

      const [agency, sidebarOptions, subaccounts] = await Promise.all([
          store.listAgencyNavigations(context.agencyId),
          store.listAgencySidebarOptions(context.agencyId),
          store.listAgencySubaccounts(context.agencyId),
        ])

      const agencyProjection = exactlyOne(agency)
      if (agencyProjection.id !== context.agencyId) {
        throw new AccessError('FORBIDDEN')
      }
      withinProjectionLimit(sidebarOptions)
      withinProjectionLimit(subaccounts)
      return {
        actor: { role: context.actor.role },
        agency: mapAgencyNavigation(agencyProjection),
        kind: 'agency',
        sidebarOptions: sidebarOptions
          .slice()
          .sort(
            (left, right) =>
              left.createdAt.getTime() - right.createdAt.getTime() ||
              compareById(left, right)
          )
          .map(mapSidebarOption),
        subaccounts: subaccounts
          .map((subaccount) => {
            if (subaccount.agencyId !== context.agencyId) {
              throw new AccessError('FORBIDDEN')
            }
            return mapSubaccountNavigation(subaccount)
          })
          .sort(compareByNameAndId),
      }
    },

    getSubaccountSidebarProjection: async (
      rawSubaccountId: unknown
    ): Promise<SubaccountSidebarProjection> => {
      const subaccountId = parseSelector(rawSubaccountId)
      const context = await resolveTenantContext(subaccountId)
      const [agency, currentSubaccount, sidebarOptions, subaccounts] =
        await Promise.all([
          store.listAgencyNavigations(context.agencyId),
          store.listSubaccountNavigations({
            agencyId: context.agencyId,
            subaccountId: context.subaccountId,
          }),
          store.listSubaccountSidebarOptions({
            agencyId: context.agencyId,
            subaccountId: context.subaccountId,
          }),
          getVisibleSubaccounts(context),
        ])

      const agencyProjection = exactlyOne(agency)
      if (agencyProjection.id !== context.agencyId) {
        throw new AccessError('FORBIDDEN')
      }
      withinProjectionLimit(sidebarOptions)
      const currentSubaccountProjection = exactlyOne(currentSubaccount)
      if (
        currentSubaccountProjection.id !== context.subaccountId ||
        currentSubaccountProjection.agencyId !== context.agencyId
      ) {
        throw new AccessError('FORBIDDEN')
      }
      return {
        actor: { role: context.actor.role },
        agency: mapAgencyNavigation(agencyProjection),
        currentSubaccount: mapSubaccountNavigation(currentSubaccountProjection),
        kind: 'subaccount',
        sidebarOptions: sidebarOptions
          .slice()
          .sort(
            (left, right) =>
              left.createdAt.getTime() - right.createdAt.getTime() ||
              compareById(left, right)
          )
          .map(mapSidebarOption),
        subaccounts,
      }
    },

    getAgencySubaccountsProjection: async (
      rawAgencyId: unknown
    ): Promise<AgencySubaccountsProjection> => {
      const agencyId = parseSelector(rawAgencyId)
      const context = await resolveAgencyContext(agencyId)
      assertAgencyOperator(context)
      const [agency, subaccounts] = await Promise.all([
        store.listAgencyReferences(context.agencyId),
        store.listAgencySubaccounts(context.agencyId),
      ])
      const agencyProjection = exactlyOne(agency)
      if (agencyProjection.id !== context.agencyId) {
        throw new AccessError('FORBIDDEN')
      }
      withinProjectionLimit(subaccounts)
      return {
        agency: mapAgencyReference(agencyProjection),
        subaccounts: subaccounts
          .map((subaccount) => {
            if (subaccount.agencyId !== context.agencyId) {
              throw new AccessError('FORBIDDEN')
            }
            return mapSubaccountNavigation(subaccount)
          })
          .sort(compareByNameAndId),
      }
    },

    getAgencySettingsProjection: async (
      rawAgencyId: unknown
    ): Promise<AgencySettingsProjection> => {
      const agencyId = parseSelector(rawAgencyId)
      const context = await resolveAgencyContext(agencyId)
      assertAgencyOperator(context)
      const [actor, agency, subaccounts] = await Promise.all([
        store.listActorProfiles({
          actorId: context.actor.id,
          agencyId: context.agencyId,
        }),
        store.listAgencyProfiles(context.agencyId),
        store.listAgencySubaccountSelectors(context.agencyId),
      ])
      const actorProjection = exactlyOne(actor)
      const agencyProjection = exactlyOne(agency)
      if (
        actorProjection.id !== context.actor.id ||
        agencyProjection.id !== context.agencyId
      ) {
        throw new AccessError('FORBIDDEN')
      }
      withinProjectionLimit(subaccounts)
      return {
        actor: mapActorProfile(actorProjection),
        agency: mapAgencyProfile(agencyProjection),
        subaccounts: subaccounts
          .map((subaccount) => {
            if (subaccount.agencyId !== context.agencyId) {
              throw new AccessError('FORBIDDEN')
            }
            return { id: subaccount.id, name: subaccount.name }
          })
          .sort(compareByNameAndId)
      }
    },

    getSubaccountSettingsProjection: async (
      rawSubaccountId: unknown
    ): Promise<SubaccountSettingsProjection> => {
      const subaccountId = parseSelector(rawSubaccountId)
      const context = await resolveTenantContext(subaccountId)
      const [actor, agency, details, subaccounts] = await Promise.all([
        store.listActorProfiles({
          actorId: context.actor.id,
          agencyId: context.agencyId,
        }),
        store.listAgencyReferences(context.agencyId),
        store.listSubaccountDetails({
          agencyId: context.agencyId,
          subaccountId: context.subaccountId,
        }),
        getVisibleSubaccountSelectors(context),
      ])
      const actorProjection = exactlyOne(actor)
      const agencyProjection = exactlyOne(agency)
      if (
        actorProjection.id !== context.actor.id ||
        agencyProjection.id !== context.agencyId
      ) {
        throw new AccessError('FORBIDDEN')
      }
      return {
        actor: mapActorProfile(actorProjection),
        agency: mapAgencyReference(agencyProjection),
        details: (() => {
          const selected = exactlyOne(details)
          if (
            selected.id !== context.subaccountId ||
            selected.agencyId !== context.agencyId
          ) {
            throw new AccessError('FORBIDDEN')
          }
          return {
            address: selected.address,
            city: selected.city,
            companyEmail: selected.companyEmail,
            companyPhone: selected.companyPhone,
            country: selected.country,
            id: selected.id,
            name: selected.name,
            state: selected.state,
            subAccountLogo: selected.subAccountLogo,
            zipCode: selected.zipCode,
          }
        })(),
        subaccounts,
      }
    },

    listTicketAssigneeOptions: async (
      rawSubaccountId: unknown
    ): Promise<readonly TicketAssigneeOption[]> => {
      const subaccountId = parseSelector(rawSubaccountId)
      const context = await resolveTenantContext(subaccountId)
      const set = exactlyOne(
        await store.listTicketAssigneeSets({
          agencyId: context.agencyId,
          subaccountId: context.subaccountId,
        })
      )
      if (
        set.id !== context.subaccountId ||
        set.agencyId !== context.agencyId
      ) {
        throw new AccessError('FORBIDDEN')
      }
      const assignees = withinProjectionLimit(set.assignees)
      assertDistinct(assignees, (assignee) => assignee.id)
      for (const assignee of assignees) {
        if (
          assignee.role !== Role.SUBACCOUNT_USER ||
          assignee.userAgencyId !== context.agencyId ||
          assignee.subaccountAgencyId !== context.agencyId
        ) {
          throw new AccessError('FORBIDDEN')
        }
      }
      return assignees
        .slice()
        .sort(compareByNameAndId)
        .map(({ avatarUrl, id, name }) => ({ avatarUrl, id, name }))
    },
  }
}
