import { describe, expect, test } from 'bun:test'
import { Icon, Role } from '@prisma/client'
import { AccessError } from '@/lib/auth/access-error'
import type { AgencyContext } from '@/lib/auth/agency-context'
import type { TenantContext } from '@/lib/auth/tenant-context'
import {
  createProjectionService,
  type ProjectionStore,
} from '@/features/agency-projections/projection-service'

const agencyId = 'agency-a'
const actorId = 'actor-a'
const subaccountId = 'sub-a'
const createdAt = new Date('2026-01-01T00:00:00.000Z')

const agencyNavigation = {
  address: '1 Main',
  agencyLogo: '/agency.svg',
  id: agencyId,
  name: 'Agency',
  whiteLabel: false,
}

const agencyProfile = {
  address: '1 Main',
  agencyLogo: '/agency.svg',
  city: 'Oakland',
  companyEmail: 'agency@example.invalid',
  companyPhone: '555-0100',
  country: 'US',
  goal: 5,
  id: agencyId,
  name: 'Agency',
  state: 'CA',
  whiteLabel: false,
  zipCode: '94601',
}

const actorProfile = {
  avatarUrl: '/actor.svg',
  email: 'actor@example.invalid',
  id: actorId,
  name: 'Actor',
  role: Role.AGENCY_OWNER,
}

const subaccount = {
  address: '2 Main',
  agencyId,
  id: subaccountId,
  name: 'Subaccount',
  subAccountLogo: '/sub.svg',
}

const subaccountDetails = {
  address: '2 Main',
  agencyId,
  city: 'Oakland',
  companyEmail: 'sub@example.invalid',
  companyPhone: '555-0101',
  country: 'US',
  id: subaccountId,
  name: 'Subaccount',
  state: 'CA',
  subAccountLogo: '/sub.svg',
  zipCode: '94601',
}

const makeStore = (overrides: Partial<ProjectionStore> = {}) => {
  const store = {
    listActorProfiles: async () => [actorProfile],
    listActorsByProviderSubject: async () => [
      { agencyId, id: actorId, role: Role.AGENCY_OWNER },
    ],
    listAgencyNavigations: async () => [agencyNavigation],
    listAgencyProfiles: async () => [agencyProfile],
    listAgencyReferences: async () => [{ id: agencyId }],
    listAgencySidebarOptions: async () => [
      {
        createdAt,
        icon: Icon.settings,
        id: 'option-b',
        link: '/settings',
        name: 'Settings',
      },
      {
        createdAt,
        icon: Icon.home,
        id: 'option-a',
        link: '/home',
        name: 'Home',
      },
    ],
    listAgencySubaccounts: async () => [subaccount],
    listAgencySubaccountSelectors: async () => [
      { agencyId, id: subaccountId, name: subaccount.name },
    ],
    listDefaultRedirectPermissions: async () => [
      { access: true, subaccountAgencyId: agencyId, subaccountId },
    ],
    listLegacyActorNames: async () => [{ name: 'Actor' }],
    listPermittedSubaccounts: async () => [
      { access: true, permissionId: 'permission-a', subaccount },
    ],
    listPermittedSubaccountSelectors: async () => [
      {
        access: true,
        permissionId: 'permission-a',
        subaccount: { agencyId, id: subaccountId, name: subaccount.name },
      },
    ],
    listSubaccountDetails: async () => [subaccountDetails],
    listSubaccountNavigations: async () => [subaccount],
    listSubaccountSidebarOptions: async () => [
      {
        createdAt,
        icon: Icon.home,
        id: 'sub-option-a',
        link: '/subaccount',
        name: 'Home',
      },
    ],
    listTicketAssigneeSets: async () => [
      {
        agencyId,
        assignees: [
          {
            avatarUrl: '/member.svg',
            id: 'member-a',
            name: 'Member',
            permissionId: 'permission-a',
            role: Role.SUBACCOUNT_USER,
            subaccountAgencyId: agencyId,
            userAgencyId: agencyId,
          },
        ],
        id: subaccountId,
      },
    ],
    ...overrides,
  } satisfies ProjectionStore
  return store
}

const makeAgencyContext = (role: Role = Role.AGENCY_OWNER): AgencyContext => ({
  actor: { id: actorId, providerSubject: actorId, role },
  agencyId,
})

const makeTenantContext = (role: Role = Role.AGENCY_OWNER): TenantContext => ({
  actor: { id: actorId, providerSubject: actorId, role },
  agencyId,
  correlationId: 'correlation-a',
  scope: { subaccountIds: [subaccountId] },
  subaccountId,
})

const makeService = (values: {
  agencyRole?: Role
  identitySubject?: string | null
  store?: ProjectionStore
  tenantRole?: Role
} = {}) =>
  createProjectionService({
    identityProvider: async () =>
      values.identitySubject === null
        ? null
        : { subject: values.identitySubject ?? actorId },
    resolveAgencyContext: async () => makeAgencyContext(values.agencyRole),
    resolveTenantContext: async () => makeTenantContext(values.tenantRole),
    store: values.store ?? makeStore(),
  })

const expectAccessCode = async (
  operation: Promise<unknown>,
  code: AccessError['code']
) => {
  try {
    await operation
    throw new Error('Expected AccessError')
  } catch (error) {
    expect(error).toBeInstanceOf(AccessError)
    if (error instanceof AccessError) expect(error.code).toBe(code)
  }
}

describe('B5A2A actor-safe projection service', () => {
  test('returns tenant-free onboarding for an authenticated subject without a local actor', async () => {
    let tenantReads = 0
    const store = makeStore({
      listActorsByProviderSubject: async () => [],
      listAgencyNavigations: async () => {
        tenantReads += 1
        return []
      },
    })
    expect(await makeService({ store }).getAccountEntryProjection()).toEqual({
      kind: 'ONBOARDING',
    })
    expect(tenantReads).toBe(0)
  })

  test('allows only an unassigned owner to enter onboarding', async () => {
    const owner = makeStore({
      listActorsByProviderSubject: async () => [
        { agencyId: null, id: actorId, role: Role.AGENCY_OWNER },
      ],
    })
    expect(await makeService({ store: owner }).getAccountEntryProjection()).toEqual({
      kind: 'ONBOARDING',
    })

    const admin = makeStore({
      listActorsByProviderSubject: async () => [
        { agencyId: null, id: actorId, role: Role.AGENCY_ADMIN },
      ],
    })
    await expectAccessCode(
      makeService({ store: admin }).getAccountEntryProjection(),
      'FORBIDDEN'
    )
  })

  test('routes every valid provisioned role with only role and agency ID', async () => {
    for (const role of Object.values(Role)) {
      const store = makeStore({
        listActorsByProviderSubject: async () => [
          { agencyId, id: actorId, role },
        ],
      })
      const result = await makeService({ store }).getAccountEntryProjection()
      expect(result).toEqual({ agencyId, kind: 'ROUTE', role })
      expect(Object.keys(result).sort()).toEqual(['agencyId', 'kind', 'role'])
    }
  })

  test('denies anonymous, mismatched, and ambiguous actor states', async () => {
    await expectAccessCode(
      makeService({ identitySubject: null }).getAccountEntryProjection(),
      'UNAUTHENTICATED'
    )
    await expectAccessCode(
      makeService({
        store: makeStore({
          listActorsByProviderSubject: async () => [
            { agencyId, id: 'different', role: Role.AGENCY_OWNER },
          ],
        }),
      }).getAccountEntryProjection(),
      'FORBIDDEN'
    )
    await expectAccessCode(
      makeService({
        store: makeStore({
          listActorsByProviderSubject: async () => [
            { agencyId, id: actorId, role: Role.AGENCY_OWNER },
            { agencyId, id: actorId, role: Role.AGENCY_OWNER },
          ],
        }),
      }).getAccountEntryProjection(),
      'CONFLICT'
    )
  })

  test('selects the first distinct active same-agency subaccount by ID', async () => {
    const store = makeStore({
      listDefaultRedirectPermissions: async () => [
        { access: true, subaccountAgencyId: agencyId, subaccountId: 'sub-z' },
        { access: true, subaccountAgencyId: agencyId, subaccountId: 'sub-a' },
      ],
    })
    expect(
      await makeService({ store }).getDefaultSubaccountRedirectProjection()
    ).toEqual({ subaccountId: 'sub-a' })
  })

  test('fails default routing for zero, duplicate, revoked, and cross-agency permissions', async () => {
    const cases = [
      [],
      [
        { access: true, subaccountAgencyId: agencyId, subaccountId },
        { access: true, subaccountAgencyId: agencyId, subaccountId },
      ],
      [{ access: false, subaccountAgencyId: agencyId, subaccountId }],
      [{ access: true, subaccountAgencyId: 'agency-b', subaccountId }],
    ]
    for (const permissions of cases) {
      const store = makeStore({
        listDefaultRedirectPermissions: async () => permissions,
      })
      await expectAccessCode(
        makeService({ store }).getDefaultSubaccountRedirectProjection(),
        permissions.length === 2 ? 'CONFLICT' : 'FORBIDDEN'
      )
    }
  })

  test('maps and deterministically orders the exact agency sidebar DTO', async () => {
    const result = await makeService().getAgencySidebarProjection(agencyId)
    expect(result.actor).toEqual({ role: Role.AGENCY_OWNER })
    expect(result.agency).toEqual(agencyNavigation)
    expect(result.legacyActivityActorName).toBe('Actor')
    expect(result.sidebarOptions.map((option) => option.id)).toEqual([
      'option-a',
      'option-b',
    ])
    expect(Object.keys(result.sidebarOptions[0]).sort()).toEqual([
      'icon',
      'id',
      'link',
      'name',
    ])
  })

  test('allowlist-maps adapter records instead of returning broad objects', async () => {
    const broadAgency = {
      ...agencyNavigation,
      connectAccountId: 'must-not-leak',
      customerId: 'must-not-leak',
    }
    const broadActor = {
      ...actorProfile,
      agencyId,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }
    const store = makeStore({
      listActorProfiles: async () => [broadActor],
      listAgencyNavigations: async () => [broadAgency],
    })
    const sidebar = await makeService({ store }).getAgencySidebarProjection(
      agencyId
    )
    expect(sidebar.agency).toEqual(agencyNavigation)
    expect('customerId' in sidebar.agency).toBe(false)

    const settings = await makeService({ store }).getAgencySettingsProjection(
      agencyId
    )
    expect(settings.actor).toEqual(actorProfile)
    expect('agencyId' in settings.actor).toBe(false)
  })

  test('denies agency projection to non-operators before projection reads', async () => {
    let reads = 0
    const store = makeStore({
      listAgencyNavigations: async () => {
        reads += 1
        return [agencyNavigation]
      },
    })
    await expectAccessCode(
      makeService({ agencyRole: Role.SUBACCOUNT_USER, store })
        .getAgencySidebarProjection(agencyId),
      'FORBIDDEN'
    )
    expect(reads).toBe(0)
  })

  test('returns only permitted same-agency switcher rows to a subaccount user', async () => {
    const result = await makeService({
      tenantRole: Role.SUBACCOUNT_USER,
    }).getSubaccountSidebarProjection(subaccountId)
    expect(result.currentSubaccount).toEqual({
      address: subaccount.address,
      id: subaccount.id,
      name: subaccount.name,
      subAccountLogo: subaccount.subAccountLogo,
    })
    expect(result.subaccounts).toHaveLength(1)
    expect('legacyActivityActorName' in result).toBe(false)
  })

  test('fails closed for duplicate or foreign switcher rows', async () => {
    const duplicate = {
      access: true,
      permissionId: 'permission-b',
      subaccount,
    }
    await expectAccessCode(
      makeService({
        store: makeStore({
          listPermittedSubaccounts: async () => [duplicate, duplicate],
        }),
        tenantRole: Role.SUBACCOUNT_USER,
      }).getSubaccountSidebarProjection(subaccountId),
      'CONFLICT'
    )
    await expectAccessCode(
      makeService({
        store: makeStore({
          listAgencySubaccounts: async () => [
            { ...subaccount, agencyId: 'agency-b' },
          ],
        }),
      }).getAgencySubaccountsProjection(agencyId),
      'FORBIDDEN'
    )
  })

  test('returns exact all-subaccounts and settings DTOs', async () => {
    const all = await makeService().getAgencySubaccountsProjection(agencyId)
    expect(all.agency).toEqual({ id: agencyId })
    expect(Object.keys(all.subaccounts[0]).sort()).toEqual([
      'address',
      'id',
      'name',
      'subAccountLogo',
    ])

    const agency = await makeService().getAgencySettingsProjection(agencyId)
    expect(agency.agency).toEqual(agencyProfile)
    expect(agency.actor).toEqual(actorProfile)
    expect(agency.subaccounts).toEqual([{ id: subaccountId, name: 'Subaccount' }])

    const tenant = await makeService().getSubaccountSettingsProjection(
      subaccountId
    )
    expect(tenant.agency).toEqual({ id: agencyId })
    expect(Object.keys(tenant.details).sort()).toEqual([
      'address',
      'city',
      'companyEmail',
      'companyPhone',
      'country',
      'id',
      'name',
      'state',
      'subAccountLogo',
      'zipCode',
    ])
  })

  test('returns only exact ordered SUBACCOUNT_USER assignee options', async () => {
    const store = makeStore({
      listTicketAssigneeSets: async () => [
        {
          agencyId,
          assignees: [
            {
              avatarUrl: '/z.svg',
              id: 'member-z',
              name: 'Zed',
              permissionId: 'permission-z',
              role: Role.SUBACCOUNT_USER,
              subaccountAgencyId: agencyId,
              userAgencyId: agencyId,
            },
            {
              avatarUrl: '/a.svg',
              id: 'member-a',
              name: 'Ada',
              permissionId: 'permission-a',
              role: Role.SUBACCOUNT_USER,
              subaccountAgencyId: agencyId,
              userAgencyId: agencyId,
            },
          ],
          id: subaccountId,
        },
      ],
    })
    const result = await makeService({ store }).listTicketAssigneeOptions(
      subaccountId
    )
    expect(result).toEqual([
      { avatarUrl: '/a.svg', id: 'member-a', name: 'Ada' },
      { avatarUrl: '/z.svg', id: 'member-z', name: 'Zed' },
    ])
  })

  test('rejects guest, duplicate, foreign, and malformed assignee requests', async () => {
    const invalidAssignee = {
      avatarUrl: '/member.svg',
      id: 'member-a',
      name: 'Member',
      permissionId: 'permission-a',
      role: Role.SUBACCOUNT_GUEST,
      subaccountAgencyId: agencyId,
      userAgencyId: agencyId,
    }
    await expectAccessCode(
      makeService({
        store: makeStore({
          listTicketAssigneeSets: async () => [
            { agencyId, assignees: [invalidAssignee], id: subaccountId },
          ],
        }),
      }).listTicketAssigneeOptions(subaccountId),
      'FORBIDDEN'
    )
    await expectAccessCode(
      makeService({
        store: makeStore({
          listTicketAssigneeSets: async () => [
            {
              agencyId,
              assignees: [invalidAssignee, invalidAssignee],
              id: subaccountId,
            },
          ],
        }),
      }).listTicketAssigneeOptions(subaccountId),
      'CONFLICT'
    )
    await expectAccessCode(
      makeService().listTicketAssigneeOptions(' '.repeat(2)),
      'FORBIDDEN'
    )
    await expectAccessCode(
      makeService().listTicketAssigneeOptions('x'.repeat(129)),
      'FORBIDDEN'
    )
  })

  test('fails closed when agency records disappear or change parent after context resolution', async () => {
    const cases: Array<Partial<ProjectionStore>> = [
      { listAgencyNavigations: async () => [] },
      {
        listAgencyNavigations: async () => [
          { ...agencyNavigation, id: 'agency-deleted-and-replaced' },
        ],
      },
      { listAgencyReferences: async () => [] },
      { listAgencyProfiles: async () => [] },
      { listActorProfiles: async () => [] },
    ]

    await expectAccessCode(
      makeService({ store: makeStore(cases[0]) }).getAgencySidebarProjection(
        agencyId
      ),
      'FORBIDDEN'
    )
    await expectAccessCode(
      makeService({ store: makeStore(cases[1]) }).getAgencySidebarProjection(
        agencyId
      ),
      'FORBIDDEN'
    )
    await expectAccessCode(
      makeService({ store: makeStore(cases[2]) }).getAgencySubaccountsProjection(
        agencyId
      ),
      'FORBIDDEN'
    )
    await expectAccessCode(
      makeService({ store: makeStore(cases[3]) }).getAgencySettingsProjection(
        agencyId
      ),
      'FORBIDDEN'
    )
    await expectAccessCode(
      makeService({ store: makeStore(cases[4]) }).getAgencySettingsProjection(
        agencyId
      ),
      'FORBIDDEN'
    )
  })

  test('fails closed for missing, deleted, wrong-parent, and orphaned subaccounts after context resolution', async () => {
    await expectAccessCode(
      makeService({
        store: makeStore({ listSubaccountNavigations: async () => [] }),
      }).getSubaccountSidebarProjection(subaccountId),
      'FORBIDDEN'
    )
    await expectAccessCode(
      makeService({
        store: makeStore({
          listSubaccountNavigations: async () => [
            { ...subaccount, agencyId: 'agency-b' },
          ],
        }),
      }).getSubaccountSidebarProjection(subaccountId),
      'FORBIDDEN'
    )
    await expectAccessCode(
      makeService({
        store: makeStore({
          listSubaccountDetails: async () => [
            { ...subaccountDetails, id: 'sub-replaced' },
          ],
        }),
      }).getSubaccountSettingsProjection(subaccountId),
      'FORBIDDEN'
    )
    await expectAccessCode(
      makeService({
        store: makeStore({ listSubaccountDetails: async () => [] }),
      }).getSubaccountSettingsProjection(subaccountId),
      'FORBIDDEN'
    )
  })

  test('binds a valid empty assignee list to an existing exact tenant', async () => {
    const store = makeStore({
      listTicketAssigneeSets: async () => [
        { agencyId, assignees: [], id: subaccountId },
      ],
    })
    expect(
      await makeService({ store }).listTicketAssigneeOptions(subaccountId)
    ).toEqual([])
  })

  test('denies deleted, replaced, orphaned, and ambiguous assignee targets', async () => {
    const targets = [
      [],
      [{ agencyId, assignees: [], id: 'sub-replaced' }],
      [{ agencyId: 'agency-b', assignees: [], id: subaccountId }],
      [
        { agencyId, assignees: [], id: subaccountId },
        { agencyId, assignees: [], id: subaccountId },
      ],
    ]
    for (const target of targets) {
      await expectAccessCode(
        makeService({
          store: makeStore({ listTicketAssigneeSets: async () => target }),
        }).listTicketAssigneeOptions(subaccountId),
        target.length > 1 ? 'CONFLICT' : 'FORBIDDEN'
      )
    }
  })

  test('rejects stale, foreign, and duplicate assignee rows without returning partial data', async () => {
    const valid = {
      avatarUrl: '/member.svg',
      id: 'member-a',
      name: 'Member',
      permissionId: 'permission-a',
      role: Role.SUBACCOUNT_USER,
      subaccountAgencyId: agencyId,
      userAgencyId: agencyId,
    }
    const invalidRows = [
      [{ ...valid, role: Role.SUBACCOUNT_GUEST }],
      [{ ...valid, userAgencyId: 'agency-b' }],
      [{ ...valid, subaccountAgencyId: 'agency-b' }],
      [valid, { ...valid, permissionId: 'permission-b' }],
    ]
    for (const assignees of invalidRows) {
      await expectAccessCode(
        makeService({
          store: makeStore({
            listTicketAssigneeSets: async () => [
              { agencyId, assignees, id: subaccountId },
            ],
          }),
        }).listTicketAssigneeOptions(subaccountId),
        assignees.length > 1 ? 'CONFLICT' : 'FORBIDDEN'
      )
    }
  })

  test('fails closed instead of truncating every bounded collection', async () => {
    const options = Array.from({ length: 251 }, (_, index) => ({
      createdAt,
      icon: Icon.home,
      id: `option-${index}`,
      link: `/option-${index}`,
      name: `Option ${index}`,
    }))
    const subaccounts = Array.from({ length: 251 }, (_, index) => ({
      ...subaccount,
      id: `sub-${index}`,
      name: `Subaccount ${index}`,
    }))
    const selectors = subaccounts.map(({ agencyId: owner, id, name }) => ({
      agencyId: owner,
      id,
      name,
    }))
    const permissions = subaccounts.map((item, index) => ({
      access: true,
      permissionId: `permission-${index}`,
      subaccount: item,
    }))
    const selectorPermissions = selectors.map((item, index) => ({
      access: true,
      permissionId: `selector-permission-${index}`,
      subaccount: item,
    }))
    const redirects = subaccounts.map((item) => ({
      access: true,
      subaccountAgencyId: agencyId,
      subaccountId: item.id,
    }))
    const assignees = Array.from({ length: 251 }, (_, index) => ({
      avatarUrl: `/member-${index}.svg`,
      id: `member-${index}`,
      name: `Member ${index}`,
      permissionId: `permission-${index}`,
      role: Role.SUBACCOUNT_USER,
      subaccountAgencyId: agencyId,
      userAgencyId: agencyId,
    }))

    const operations: Array<Promise<unknown>> = [
      makeService({
        store: makeStore({ listAgencySidebarOptions: async () => options }),
      }).getAgencySidebarProjection(agencyId),
      makeService({
        store: makeStore({ listAgencySubaccounts: async () => subaccounts }),
      }).getAgencySubaccountsProjection(agencyId),
      makeService({
        store: makeStore({
          listAgencySubaccountSelectors: async () => selectors,
        }),
      }).getAgencySettingsProjection(agencyId),
      makeService({
        store: makeStore({
          listDefaultRedirectPermissions: async () => redirects,
        }),
      }).getDefaultSubaccountRedirectProjection(),
      makeService({
        store: makeStore({ listPermittedSubaccounts: async () => permissions }),
        tenantRole: Role.SUBACCOUNT_USER,
      }).getSubaccountSidebarProjection(subaccountId),
      makeService({
        store: makeStore({
          listPermittedSubaccountSelectors: async () => selectorPermissions,
        }),
        tenantRole: Role.SUBACCOUNT_USER,
      }).getSubaccountSettingsProjection(subaccountId),
      makeService({
        store: makeStore({ listSubaccountSidebarOptions: async () => options }),
      }).getSubaccountSidebarProjection(subaccountId),
      makeService({
        store: makeStore({
          listTicketAssigneeSets: async () => [
            { agencyId, assignees, id: subaccountId },
          ],
        }),
      }).listTicketAssigneeOptions(subaccountId),
    ]
    for (const operation of operations) {
      await expectAccessCode(operation, 'CONFLICT')
    }
  })

  test('detects duplicate permission or assignee corruption beyond row 250', async () => {
    const redirect = {
      access: true,
      subaccountAgencyId: agencyId,
      subaccountId,
    }
    const redirects = Array.from({ length: 250 }, (_, index) => ({
      ...redirect,
      subaccountId: `sub-${index}`,
    })).concat(redirect)
    await expectAccessCode(
      makeService({
        store: makeStore({
          listDefaultRedirectPermissions: async () => redirects,
        }),
      }).getDefaultSubaccountRedirectProjection(),
      'CONFLICT'
    )

    const assignee = {
      avatarUrl: '/member.svg',
      id: 'member-a',
      name: 'Member',
      permissionId: 'permission-a',
      role: Role.SUBACCOUNT_USER,
      subaccountAgencyId: agencyId,
      userAgencyId: agencyId,
    }
    const assignees = Array.from({ length: 250 }, (_, index) => ({
      ...assignee,
      id: `member-${index}`,
      permissionId: `permission-${index}`,
    })).concat(assignee)
    await expectAccessCode(
      makeService({
        store: makeStore({
          listTicketAssigneeSets: async () => [
            { agencyId, assignees, id: subaccountId },
          ],
        }),
      }).listTicketAssigneeOptions(subaccountId),
      'CONFLICT'
    )
  })

  test('uses selector-only settings reads and does not consult navigation records', async () => {
    let navigationReads = 0
    const store = makeStore({
      listAgencySubaccounts: async () => {
        navigationReads += 1
        return [subaccount]
      },
    })
    await makeService({ store }).getAgencySettingsProjection(agencyId)
    await makeService({ store }).getSubaccountSettingsProjection(subaccountId)
    expect(navigationReads).toBe(0)
  })

  test('allowlist mapping excludes sensitive and nested fields from every projection class', async () => {
    const forbiddenFields = [
      'connectAccountId',
      'customerId',
      'notification',
      'contact',
      'funnel',
      'pipeline',
      'ticket',
      'permissionGraph',
      'nestedAgency',
      'createdAt',
      'updatedAt',
    ]
    const store = makeStore({
      listAgencyNavigations: async () => [
        Object.assign({}, agencyNavigation, {
          connectAccountId: 'excluded',
          customerId: 'excluded',
          nestedAgency: { id: agencyId },
        }),
      ],
      listAgencySubaccounts: async () => [
        Object.assign({}, subaccount, {
          contact: [],
          funnel: [],
          notification: [],
          permissionGraph: [],
          pipeline: [],
          ticket: [],
        }),
      ],
      listTicketAssigneeSets: async () => [
        {
          agencyId,
          assignees: [
            Object.assign(
              {
                avatarUrl: '/member.svg',
                id: 'member-a',
                name: 'Member',
                permissionId: 'permission-a',
                role: Role.SUBACCOUNT_USER,
                subaccountAgencyId: agencyId,
                userAgencyId: agencyId,
              },
              { email: 'excluded@example.invalid', nestedAgency: {} }
            ),
          ],
          id: subaccountId,
        },
      ],
    })
    const sidebar = await makeService({ store }).getAgencySidebarProjection(
      agencyId
    )
    const assignees = await makeService({ store }).listTicketAssigneeOptions(
      subaccountId
    )
    const serialized = JSON.stringify({ assignees, sidebar })
    for (const field of [...forbiddenFields, 'email']) {
      expect(serialized).not.toContain(`\"${field}\"`)
    }
  })
})
