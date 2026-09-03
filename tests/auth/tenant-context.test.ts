import { describe, expect, test } from 'bun:test'
import { Role } from '@prisma/client'
import { AccessError } from '../../src/lib/auth/access-error'
import {
  resolveTenantContext,
  type TenantActorRecord,
  type TenantRepository,
} from '../../src/lib/auth/tenant-context'

const identityProvider = async () => ({ subject: 'clerk-user-1' })

const actor = (
  overrides: Partial<TenantActorRecord> = {}
): TenantActorRecord => ({
  agencyId: 'agency-a',
  id: 'clerk-user-1',
  permissions: [],
  role: Role.SUBACCOUNT_USER,
  ...overrides,
})

const repository = (
  actorRecord: TenantActorRecord | null,
  subaccount: { agencyId: string; id: string } | null = {
    agencyId: 'agency-a',
    id: 'sub-a',
  }
): TenantRepository => ({
  findActorByProviderSubject: async (subject) =>
    subject === 'clerk-user-1' ? actorRecord : null,
  findSubaccountById: async (id) =>
    subaccount?.id === id ? subaccount : null,
})

const resolve = (
  actorRecord: TenantActorRecord | null,
  subaccount?: { agencyId: string; id: string } | null
) =>
  resolveTenantContext({
    correlationId: 'correlation-1',
    identityProvider,
    repository: repository(actorRecord, subaccount),
    requestedSubaccountId: 'sub-a',
  })

const expectAccessError = async (
  operation: Promise<unknown>,
  code: AccessError['code']
) => {
  try {
    await operation
    throw new Error('Expected operation to be denied')
  } catch (error) {
    expect(error).toBeInstanceOf(AccessError)
    expect((error as AccessError).code).toBe(code)
  }
}

describe('resolveTenantContext', () => {
  test('requires an authenticated provider subject', async () => {
    await expectAccessError(
      resolveTenantContext({
        correlationId: 'correlation-1',
        identityProvider: async () => null,
        repository: repository(actor()),
        requestedSubaccountId: 'sub-a',
      }),
      'UNAUTHENTICATED'
    )
  })

  test('requires a matching provisioned local user', async () => {
    await expectAccessError(resolve(null), 'PROVISIONING_REQUIRED')
  })

  test.each([
    ['null agency', actor({ agencyId: null }), undefined],
    [
      'cross-agency owner',
      actor({ role: Role.AGENCY_OWNER }),
      { agencyId: 'agency-b', id: 'sub-a' },
    ],
    [
      'cross-agency admin',
      actor({ role: Role.AGENCY_ADMIN }),
      { agencyId: 'agency-b', id: 'sub-a' },
    ],
    ['orphaned target', actor(), null],
  ])('denies %s', async (_, actorRecord, subaccount) => {
    await expectAccessError(resolve(actorRecord, subaccount), 'FORBIDDEN')
  })

  test.each([
    ['no permission', []],
    [
      'permission for a different subaccount',
      [{ access: true, agencyId: 'agency-a', subaccountId: 'sub-b' }],
    ],
    [
      'revoked permission',
      [{ access: false, agencyId: 'agency-a', subaccountId: 'sub-a' }],
    ],
    [
      'orphaned permission',
      [{ access: true, agencyId: null, subaccountId: 'sub-a' }],
    ],
    [
      'cross-agency permission',
      [{ access: true, agencyId: 'agency-b', subaccountId: 'sub-a' }],
    ],
    [
      'duplicate permissions',
      [
        { access: true, agencyId: 'agency-a', subaccountId: 'sub-a' },
        { access: true, agencyId: 'agency-a', subaccountId: 'sub-a' },
      ],
    ],
    [
      'conflicting permissions',
      [
        { access: true, agencyId: 'agency-a', subaccountId: 'sub-a' },
        { access: false, agencyId: 'agency-a', subaccountId: 'sub-a' },
      ],
    ],
  ])('denies a subaccount user with %s', async (_, permissions) => {
    await expectAccessError(resolve(actor({ permissions })), 'FORBIDDEN')
  })

  test.each([Role.SUBACCOUNT_USER, Role.SUBACCOUNT_GUEST])(
    'denies corrupted permission state for %s',
    async (role) => {
      const invalidPermissionSets = [
        [],
        [{ access: false, agencyId: 'agency-a', subaccountId: 'sub-a' }],
        [{ access: true, agencyId: null, subaccountId: 'sub-a' }],
        [{ access: true, agencyId: 'agency-b', subaccountId: 'sub-a' }],
        [
          { access: true, agencyId: 'agency-a', subaccountId: 'sub-a' },
          { access: true, agencyId: 'agency-a', subaccountId: 'sub-a' },
        ],
        [
          { access: true, agencyId: 'agency-a', subaccountId: 'sub-a' },
          { access: false, agencyId: 'agency-a', subaccountId: 'sub-a' },
        ],
      ]

      for (const permissions of invalidPermissionSets) {
        await expectAccessError(
          resolve(actor({ permissions, role })),
          'FORBIDDEN'
        )
      }
    }
  )

  test.each([null, 42, '', 'x'.repeat(129)])(
    'rejects malformed resource selector %p',
    async (requestedSubaccountId) => {
      await expectAccessError(
        resolveTenantContext({
          correlationId: 'correlation-1',
          identityProvider,
          repository: repository(actor()),
          requestedSubaccountId,
        }),
        'FORBIDDEN'
      )
    }
  )

  test.each([Role.AGENCY_OWNER, Role.AGENCY_ADMIN])(
    'allows same-agency %s',
    async (role) => {
      const context = await resolve(actor({ role }))
      expect(context.agencyId).toBe('agency-a')
      expect(context.scope.subaccountIds).toEqual(['sub-a'])
    }
  )

  test.each([Role.SUBACCOUNT_USER, Role.SUBACCOUNT_GUEST])(
    'allows an explicitly permitted %s',
    async (role) => {
      const context = await resolve(
        actor({
          role,
          permissions: [
            { access: true, agencyId: 'agency-a', subaccountId: 'sub-a' },
          ],
        })
      )
      expect(context.actor.providerSubject).toBe('clerk-user-1')
      expect(context.correlationId).toBe('correlation-1')
    }
  )
})
