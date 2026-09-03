import { describe, expect, test } from 'bun:test'
import { Role } from '@prisma/client'
import { AccessError } from '../../src/lib/auth/access-error'
import {
  createAccountService,
  type AccountInvitationRecord,
  type AccountStore,
  type AccountUserRecord,
} from '../../src/features/accounts/account-service'

const user = (
  overrides: Partial<AccountUserRecord> = {}
): AccountUserRecord => ({
  agencyId: 'agency-a',
  email: 'person@example.com',
  id: 'provider-a',
  role: Role.SUBACCOUNT_USER,
  ...overrides,
})

const invitation = (
  overrides: Partial<AccountInvitationRecord> = {}
): AccountInvitationRecord => ({
  agencyId: 'agency-a',
  email: 'person@example.com',
  id: 'invitation-a',
  role: Role.SUBACCOUNT_GUEST,
  status: 'PENDING',
  ...overrides,
})

const createHarness = (options: {
  emailUser?: AccountUserRecord | null
  existingUser?: AccountUserRecord | null
  identity?: { subject: string } | null
  invitation?: AccountInvitationRecord | null
  profileSubject?: string
} = {}) => {
  const reads: string[] = []
  const writes: Array<{ args: unknown[]; method: string }> = []
  const store: AccountStore = {
    acceptInvitation: async (values) => {
      writes.push({ args: [values], method: 'acceptInvitation' })
      const stored = options.invitation ?? invitation()
      return user({
        agencyId: stored.agencyId,
        email: stored.email,
        id: values.providerSubject,
        role: stored.role,
      })
    },
    createAgencyOwner: async (values) => {
      writes.push({ args: [values], method: 'createAgencyOwner' })
      return user({
        agencyId: null,
        email: values.email,
        id: values.providerSubject,
        role: Role.AGENCY_OWNER,
      })
    },
    findPendingInvitationByEmail: async () => {
      reads.push('findPendingInvitationByEmail')
      return options.invitation ?? null
    },
    findUserByEmail: async () => {
      reads.push('findUserByEmail')
      return options.emailUser ?? null
    },
    findUserByProviderSubject: async () => {
      reads.push('findUserByProviderSubject')
      return options.existingUser ?? null
    },
  }
  const service = createAccountService({
    identityProvider: async () =>
      options.identity === undefined
        ? { subject: 'provider-a' }
        : options.identity,
    profileProvider: async () => ({
      avatarUrl: 'https://example.com/avatar.png',
      email: 'PERSON@EXAMPLE.COM',
      name: 'Person A',
      subject: options.profileSubject ?? 'provider-a',
    }),
    store,
  })
  return { reads, service, writes }
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

describe('account provisioning service', () => {
  test('returns an existing exact-subject account without reading profile or invitation', async () => {
    const harness = createHarness({ existingUser: user() })
    await expect(harness.service.resolveAccountEntry()).resolves.toBe('agency-a')
    expect(harness.reads).toEqual(['findUserByProviderSubject'])
    expect(harness.writes).toHaveLength(0)
  })

  test('accepts only the stored invitation agency and role', async () => {
    const stored = invitation({
      agencyId: 'agency-stored',
      role: Role.SUBACCOUNT_GUEST,
    })
    const harness = createHarness({ invitation: stored })
    await expect(harness.service.resolveAccountEntry()).resolves.toBe(
      'agency-stored'
    )
    expect(harness.writes).toEqual([
      {
        args: [
          {
            avatarUrl: 'https://example.com/avatar.png',
            email: 'person@example.com',
            invitationId: 'invitation-a',
            name: 'Person A',
            providerSubject: 'provider-a',
          },
        ],
        method: 'acceptInvitation',
      },
    ])
  })

  test('rejects a stored owner invitation and duplicate local email', async () => {
    const ownerInvitation = createHarness({
      invitation: invitation({ role: Role.AGENCY_OWNER }),
    })
    await expectCode(
      ownerInvitation.service.resolveAccountEntry(),
      'CONFLICT'
    )
    expect(ownerInvitation.writes).toHaveLength(0)

    const duplicate = createHarness({
      emailUser: user({ id: 'different-provider' }),
      invitation: invitation(),
    })
    await expectCode(duplicate.service.resolveAccountEntry(), 'CONFLICT')
    expect(duplicate.writes).toHaveLength(0)
  })

  test('rejects anonymous and mismatched provider profiles without writes', async () => {
    const anonymous = createHarness({ identity: null })
    await expectCode(
      anonymous.service.resolveAccountEntry(),
      'UNAUTHENTICATED'
    )
    expect(anonymous.reads).toHaveLength(0)

    const mismatch = createHarness({ profileSubject: 'provider-b' })
    await expectCode(mismatch.service.resolveAccountEntry(), 'FORBIDDEN')
    expect(mismatch.writes).toHaveLength(0)
  })

  test('provisions a fixed owner role without accepting caller role or agency data', async () => {
    const harness = createHarness()
    const result = await harness.service.provisionAgencyOwner()
    expect(result.role).toBe(Role.AGENCY_OWNER)
    expect(result.agencyId).toBeNull()
    expect(harness.writes[0].method).toBe('createAgencyOwner')
  })

  test('will not provision an owner over a pending invitation', async () => {
    const harness = createHarness({ invitation: invitation() })
    await expectCode(harness.service.provisionAgencyOwner(), 'CONFLICT')
    expect(harness.writes).toHaveLength(0)
  })
})
