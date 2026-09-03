import { describe, expect, test } from 'bun:test'
import { Role } from '@prisma/client'
import { AccessError } from '../../src/lib/auth/access-error'
import {
  createTeamService,
  InvitationReconciliationError,
  type TeamActorRecord,
  type TeamIdentityProvider,
  type TeamInvitationRecord,
  type TeamMemberRecord,
  type TeamPermissionRecord,
  type TeamStore,
  type TeamSubaccountRecord,
} from '../../src/features/team/team-service'

const actor = (
  role: Role = Role.AGENCY_OWNER,
  overrides: Partial<TeamActorRecord> = {}
): TeamActorRecord => ({ agencyId: 'agency-a', id: 'owner-a', role, ...overrides })

const permission = (
  overrides: Partial<TeamPermissionRecord> = {}
): TeamPermissionRecord => ({
  access: true,
  id: 'permission-a',
  subaccount: { agencyId: 'agency-a', id: 'sub-a', name: 'Sub A' },
  ...overrides,
})

const member = (
  overrides: Partial<TeamMemberRecord> = {}
): TeamMemberRecord => ({
  agencyId: 'agency-a',
  avatarUrl: 'https://example.com/avatar.png',
  email: 'member@example.com',
  id: 'member-a',
  name: 'Member A',
  permissions: [],
  role: Role.SUBACCOUNT_USER,
  ...overrides,
})

const subaccount = (
  overrides: Partial<TeamSubaccountRecord> = {}
): TeamSubaccountRecord => ({
  agencyId: 'agency-a',
  id: 'sub-a',
  name: 'Sub A',
  ...overrides,
})

const invitation = (
  overrides: Partial<TeamInvitationRecord> = {}
): TeamInvitationRecord => ({
  agencyId: 'agency-a',
  email: 'invitee@example.com',
  id: 'invitation-a',
  role: Role.SUBACCOUNT_USER,
  status: 'PENDING',
  ...overrides,
})

const createHarness = (options: {
  actor?: TeamActorRecord | null
  existingInvitation?: TeamInvitationRecord | null
  existingMemberByEmail?: TeamMemberRecord | null
  identity?: { subject: string } | null
  members?: TeamMemberRecord[]
  permissions?: TeamPermissionRecord[]
  subaccounts?: TeamSubaccountRecord[]
} = {}) => {
  const reads: string[] = []
  const writes: Array<{ args: unknown[]; method: string }> = []
  const providerCalls: Array<{ args: unknown[]; method: string }> = []
  let members = options.members ?? [member()]
  const subaccounts = options.subaccounts ?? [subaccount()]

  const store: TeamStore = {
    agencyExists: async () => {
      reads.push('agencyExists')
      return true
    },
    createInvitation: async (values) => {
      writes.push({ args: [values], method: 'createInvitation' })
      return invitation(values)
    },
    createPermission: async (values) => {
      writes.push({ args: [values], method: 'createPermission' })
      return permission({
        access: values.access,
        subaccount: subaccount({ id: values.subaccountId }),
      })
    },
    deleteMember: async (values) => {
      writes.push({ args: [values], method: 'deleteMember' })
    },
    findActorByProviderSubject: async () => {
      reads.push('findActorByProviderSubject')
      return options.actor === undefined ? actor() : options.actor
    },
    findInvitationByEmail: async () => {
      reads.push('findInvitationByEmail')
      return options.existingInvitation ?? null
    },
    findMemberByEmail: async () => {
      reads.push('findMemberByEmail')
      return options.existingMemberByEmail ?? null
    },
    findMemberById: async (memberId) => {
      reads.push('findMemberById')
      return members.find((item) => item.id === memberId) ?? null
    },
    findPermissions: async () => {
      reads.push('findPermissions')
      return options.permissions ?? []
    },
    findSubaccountById: async (subaccountId) => {
      reads.push('findSubaccountById')
      return subaccounts.find((item) => item.id === subaccountId) ?? null
    },
    listMembersByAgency: async () => {
      reads.push('listMembersByAgency')
      return members
    },
    listSubaccountsByAgency: async () => {
      reads.push('listSubaccountsByAgency')
      return subaccounts
    },
    updateMemberProfile: async (memberId, values) => {
      writes.push({ args: [memberId, values], method: 'updateMemberProfile' })
      return member({ id: memberId, ...values })
    },
    updateMemberRole: async (values) => {
      writes.push({
        args: [values],
        method: 'updateMemberRole',
      })
      const updated = member({ id: values.memberId, role: values.nextRole })
      members = members.map((item) =>
        item.id === values.memberId ? updated : item
      )
      return updated
    },
    updatePermission: async (values) => {
      writes.push({ args: [values], method: 'updatePermission' })
      return permission({ access: values.nextAccess, id: values.permissionId })
    },
  }

  const provider: TeamIdentityProvider = {
    createInvitation: async (...args) => {
      providerCalls.push({ args, method: 'createInvitation' })
      return 'provider-invitation-a'
    },
    revokeInvitation: async (...args) => {
      providerCalls.push({ args, method: 'revokeInvitation' })
    },
  }

  const service = createTeamService({
    identityProvider: async () =>
      options.identity === undefined
        ? { subject: 'owner-a' }
        : options.identity,
    provider,
    store,
  })

  return { provider, providerCalls, reads, service, store, writes }
}

const expectCode = async (
  operation: Promise<unknown>,
  code: AccessError['code']
) => {
  try {
    await operation
    throw new Error('Expected access error')
  } catch (error) {
    expect(error).toBeInstanceOf(AccessError)
    expect((error as AccessError).code).toBe(code)
  }
}

describe('team authority service', () => {
  test('allows an owner to list only the agency selected by the route', async () => {
    const { service } = createHarness()
    const result = await service.list('agency-a')
    expect(result.agencyId).toBe('agency-a')
    expect(result.members.map((item) => item.id)).toEqual(['member-a'])

    const denied = createHarness()
    await expectCode(denied.service.list('agency-b'), 'FORBIDDEN')
    expect(denied.writes).toHaveLength(0)
    expect(denied.providerCalls).toHaveLength(0)
  })

  test.each([
    [Role.AGENCY_ADMIN, { subject: 'owner-a' }],
    [Role.SUBACCOUNT_USER, { subject: 'owner-a' }],
    [Role.SUBACCOUNT_GUEST, { subject: 'owner-a' }],
  ])('denies team administration to %s with zero side effects', async (role, identity) => {
    const harness = createHarness({ actor: actor(role), identity })
    await expectCode(harness.service.list('agency-a'), 'FORBIDDEN')
    await expectCode(
      harness.service.invite({
        email: 'invitee@example.com',
        role: Role.SUBACCOUNT_USER,
      }),
      'FORBIDDEN'
    )
    expect(harness.reads).not.toContain('listMembersByAgency')
    expect(harness.writes).toHaveLength(0)
    expect(harness.providerCalls).toHaveLength(0)
  })

  test('distinguishes anonymous and unprovisioned actors without side effects', async () => {
    const anonymous = createHarness({ identity: null })
    await expectCode(anonymous.service.list('agency-a'), 'UNAUTHENTICATED')
    expect(anonymous.reads).toHaveLength(0)

    const unprovisioned = createHarness({ actor: null })
    await expectCode(
      unprovisioned.service.invite({
        email: 'invitee@example.com',
        role: Role.SUBACCOUNT_USER,
      }),
      'PROVISIONING_REQUIRED'
    )
    expect(unprovisioned.writes).toHaveLength(0)
    expect(unprovisioned.providerCalls).toHaveLength(0)
  })

  test('updates only the authenticated actor profile with an allowlisted DTO', async () => {
    const harness = createHarness()
    await harness.service.updateMyProfile({
      avatarUrl: 'https://example.com/new.png',
      name: 'New Name',
    })
    expect(harness.writes).toEqual([
      {
        args: [
          'owner-a',
          { avatarUrl: 'https://example.com/new.png', name: 'New Name' },
        ],
        method: 'updateMemberProfile',
      },
    ])

    const injected = createHarness()
    await expect(
      injected.service.updateMyProfile({
        avatarUrl: 'https://example.com/new.png',
        name: 'New Name',
        role: Role.AGENCY_OWNER,
      } as never)
    ).rejects.toThrow()
    expect(injected.reads).toHaveLength(0)
    expect(injected.writes).toHaveLength(0)
  })

  test('changes a same-agency non-owner role using scoped expected state', async () => {
    const harness = createHarness()
    await harness.service.changeRole({
      role: Role.AGENCY_ADMIN,
      targetUserId: 'member-a',
    })
    expect(harness.writes[0]).toEqual({
      args: [
        {
          agencyId: 'agency-a',
          expectedRole: Role.SUBACCOUNT_USER,
          memberId: 'member-a',
          nextRole: Role.AGENCY_ADMIN,
          revokePermissions: true,
        },
      ],
      method: 'updateMemberRole',
    })
    expect(harness.providerCalls).toHaveLength(0)
  })

  test('revokes existing permissions atomically when crossing the admin boundary', async () => {
    const target = member({ permissions: [permission()] })
    const harness = createHarness({ members: [target] })
    await harness.service.changeRole({
      role: Role.AGENCY_ADMIN,
      targetUserId: target.id,
    })
    expect(harness.writes[0]).toEqual({
      args: [
        {
          agencyId: 'agency-a',
          expectedRole: Role.SUBACCOUNT_USER,
          memberId: 'member-a',
          nextRole: Role.AGENCY_ADMIN,
          revokePermissions: true,
        },
      ],
      method: 'updateMemberRole',
    })
  })

  test.each([
    ['cross-agency target', member({ agencyId: 'agency-b' })],
    ['owner target', member({ role: Role.AGENCY_OWNER })],
    ['self target', member({ id: 'owner-a' })],
  ])('denies role changes for a %s', async (_, target) => {
    const harness = createHarness({ members: [target] })
    await expectCode(
      harness.service.changeRole({
        role: Role.AGENCY_ADMIN,
        targetUserId: target.id,
      }),
      'FORBIDDEN'
    )
    expect(harness.writes).toHaveLength(0)
    expect(harness.providerCalls).toHaveLength(0)
  })

  test('rejects owner-role injection before identity or persistence', async () => {
    const harness = createHarness()
    await expect(
      harness.service.changeRole({
        role: Role.AGENCY_OWNER,
        targetUserId: 'member-a',
      })
    ).rejects.toThrow()
    expect(harness.reads).toHaveLength(0)
    expect(harness.writes).toHaveLength(0)
  })

  test('reads a member only after owner and same-agency validation', async () => {
    const harness = createHarness()
    await expect(
      harness.service.getMember({ targetUserId: 'member-a' })
    ).resolves.toMatchObject({ id: 'member-a' })

    const crossAgency = createHarness({
      members: [member({ agencyId: 'agency-b' })],
    })
    await expectCode(
      crossAgency.service.getMember({ targetUserId: 'member-a' }),
      'FORBIDDEN'
    )
    expect(crossAgency.writes).toHaveLength(0)
  })

  test('loads a permission by member and subaccount instead of accepting its id', async () => {
    const harness = createHarness({ permissions: [permission()] })
    await harness.service.revokePermission({
      subaccountId: 'sub-a',
      targetUserId: 'member-a',
    })
    expect(harness.writes).toEqual([
      {
        args: [
          {
            email: 'member@example.com',
            expectedAccess: true,
            nextAccess: false,
            permissionId: 'permission-a',
            subaccountId: 'sub-a',
          },
        ],
        method: 'updatePermission',
      },
    ])
  })

  test('creates only an active permission and treats an absent revoke as a no-op', async () => {
    const grant = createHarness()
    await grant.service.grantPermission({
      subaccountId: 'sub-a',
      targetUserId: 'member-a',
    })
    expect(grant.writes).toEqual([
      {
        args: [
          {
            access: true,
            email: 'member@example.com',
            subaccountId: 'sub-a',
          },
        ],
        method: 'createPermission',
      },
    ])

    const revoke = createHarness()
    await expect(
      revoke.service.revokePermission({
        subaccountId: 'sub-a',
        targetUserId: 'member-a',
      })
    ).resolves.toBeNull()
    expect(revoke.writes).toHaveLength(0)
  })

  test('fails closed on duplicate, conflicting, or cross-agency permissions', async () => {
    for (const permissions of [
      [permission(), permission({ id: 'permission-b' })],
      [permission(), permission({ access: false, id: 'permission-b' })],
    ]) {
      const harness = createHarness({ permissions })
      await expectCode(
        harness.service.revokePermission({
          subaccountId: 'sub-a',
          targetUserId: 'member-a',
        }),
        'CONFLICT'
      )
      expect(harness.writes).toHaveLength(0)
    }

    const crossAgency = createHarness({
      permissions: [
        permission({
          subaccount: { agencyId: 'agency-b', id: 'sub-a', name: 'Sub A' },
        }),
      ],
    })
    await expectCode(
      crossAgency.service.revokePermission({
        subaccountId: 'sub-a',
        targetUserId: 'member-a',
      }),
      'FORBIDDEN'
    )
    expect(crossAgency.writes).toHaveLength(0)
  })

  test('denies permissions on cross-agency subaccounts and privileged targets', async () => {
    const crossAgency = createHarness({
      subaccounts: [subaccount({ agencyId: 'agency-b' })],
    })
    await expectCode(
      crossAgency.service.grantPermission({
        subaccountId: 'sub-a',
        targetUserId: 'member-a',
      }),
      'FORBIDDEN'
    )

    const admin = createHarness({
      members: [member({ role: Role.AGENCY_ADMIN })],
    })
    await expectCode(
      admin.service.grantPermission({
        subaccountId: 'sub-a',
        targetUserId: 'member-a',
      }),
      'FORBIDDEN'
    )
    expect(crossAgency.writes).toHaveLength(0)
    expect(admin.writes).toHaveLength(0)
  })

  test('removes only a same-agency non-owner using scoped expected state', async () => {
    const harness = createHarness()
    await harness.service.removeMember({ targetUserId: 'member-a' })
    expect(harness.writes).toEqual([
      {
        args: [
          {
            agencyId: 'agency-a',
            expectedRole: Role.SUBACCOUNT_USER,
            memberId: 'member-a',
          },
        ],
        method: 'deleteMember',
      },
    ])
    expect(harness.providerCalls).toHaveLength(0)
  })

  test('creates invitations from the actor agency and a non-owner role only', async () => {
    const harness = createHarness()
    const result = await harness.service.invite({
      email: '  INVITEE@EXAMPLE.COM ',
      role: Role.SUBACCOUNT_GUEST,
    })
    expect(result.agencyId).toBe('agency-a')
    expect(harness.writes).toEqual([
      {
        args: [
          {
            agencyId: 'agency-a',
            email: 'invitee@example.com',
            role: Role.SUBACCOUNT_GUEST,
          },
        ],
        method: 'createInvitation',
      },
    ])
    expect(harness.providerCalls).toEqual([
      {
        args: ['invitee@example.com'],
        method: 'createInvitation',
      },
    ])
  })

  test('rejects duplicate invitations and owner-role injection with zero writes', async () => {
    const duplicate = createHarness({ existingInvitation: invitation() })
    await expectCode(
      duplicate.service.invite({
        email: 'invitee@example.com',
        role: Role.SUBACCOUNT_USER,
      }),
      'CONFLICT'
    )
    expect(duplicate.writes).toHaveLength(0)
    expect(duplicate.providerCalls).toHaveLength(0)

    const injected = createHarness()
    await expect(
      injected.service.invite({
        email: 'invitee@example.com',
        role: Role.AGENCY_OWNER,
      })
    ).rejects.toThrow()
    expect(injected.reads).toHaveLength(0)
    expect(injected.writes).toHaveLength(0)
  })

  test('does not write an invitation if provider delivery fails', async () => {
    const harness = createHarness()
    harness.provider.createInvitation = async () => {
      throw new Error('provider unavailable')
    }
    await expect(
      harness.service.invite({
        email: 'invitee@example.com',
        role: Role.SUBACCOUNT_USER,
      })
    ).rejects.toThrow('provider unavailable')
    expect(harness.writes).toHaveLength(0)
  })

  test('revokes a provider invitation if local persistence fails', async () => {
    const harness = createHarness()
    harness.store.createInvitation = async () => {
      throw new Error('database unavailable')
    }
    await expect(
      harness.service.invite({
        email: 'invitee@example.com',
        role: Role.SUBACCOUNT_USER,
      })
    ).rejects.toThrow('database unavailable')
    expect(harness.providerCalls.map((call) => call.method)).toEqual([
      'createInvitation',
      'revokeInvitation',
    ])
  })

  test('surfaces an explicit reconciliation error if compensation fails', async () => {
    const harness = createHarness()
    harness.store.createInvitation = async () => {
      throw new Error('database unavailable')
    }
    harness.provider.revokeInvitation = async () => {
      throw new Error('provider unavailable')
    }
    await expect(
      harness.service.invite({
        email: 'invitee@example.com',
        role: Role.SUBACCOUNT_USER,
      })
    ).rejects.toBeInstanceOf(InvitationReconciliationError)
  })
})
