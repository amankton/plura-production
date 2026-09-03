import { describe, expect, test } from 'bun:test'
import { Role } from '@prisma/client'
import { AccessError } from '../../src/lib/auth/access-error'
import {
  assertAgencyOperator,
  assertAgencyOwner,
  resolveAgencyContext,
  type AgencyActorRecord,
  type AgencyRepository,
} from '../../src/lib/auth/agency-context'

const actor = (
  overrides: Partial<AgencyActorRecord> = {}
): AgencyActorRecord => ({
  agencyId: 'agency-a',
  id: 'provider-a',
  role: Role.AGENCY_OWNER,
  ...overrides,
})

const repository = (
  actorRecord: AgencyActorRecord | null,
  existingAgencyId = 'agency-a'
): AgencyRepository => ({
  agencyExists: async (agencyId) => agencyId === existingAgencyId,
  findActorByProviderSubject: async () => actorRecord,
})

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

describe('agency context', () => {
  test('resolves an exact provider subject and exact agency', async () => {
    const context = await resolveAgencyContext({
      identityProvider: async () => ({ subject: 'provider-a' }),
      repository: repository(actor()),
      requestedAgencyId: 'agency-a',
    })
    expect(context).toEqual({
      actor: {
        id: 'provider-a',
        providerSubject: 'provider-a',
        role: Role.AGENCY_OWNER,
      },
      agencyId: 'agency-a',
    })
  })

  test.each([
    ['unprovisioned actor', null, 'agency-a', 'agency-a', 'PROVISIONING_REQUIRED'],
    ['null actor agency', actor({ agencyId: null }), 'agency-a', 'agency-a', 'FORBIDDEN'],
    ['cross-agency route', actor(), 'agency-b', 'agency-a', 'FORBIDDEN'],
    ['missing agency', actor(), 'agency-a', 'agency-b', 'FORBIDDEN'],
  ] as const)(
    'denies %s',
    async (_, actorRecord, requestedAgencyId, existingAgencyId, code) => {
      await expectCode(
        resolveAgencyContext({
          identityProvider: async () => ({ subject: 'provider-a' }),
          repository: repository(actorRecord, existingAgencyId),
          requestedAgencyId,
        }),
        code
      )
    }
  )

  test('rejects malformed selectors before identity or repository access', async () => {
    let calls = 0
    await expectCode(
      resolveAgencyContext({
        identityProvider: async () => {
          calls += 1
          return { subject: 'provider-a' }
        },
        repository: repository(actor()),
        requestedAgencyId: '',
      }),
      'FORBIDDEN'
    )
    expect(calls).toBe(0)
  })

  test('requires authentication and applies distinct owner/operator policies', async () => {
    await expectCode(
      resolveAgencyContext({
        identityProvider: async () => null,
        repository: repository(actor()),
        requestedAgencyId: 'agency-a',
      }),
      'UNAUTHENTICATED'
    )

    const owner = {
      actor: { id: 'a', providerSubject: 'a', role: Role.AGENCY_OWNER },
      agencyId: 'agency-a',
    }
    const admin = {
      actor: { id: 'b', providerSubject: 'b', role: Role.AGENCY_ADMIN },
      agencyId: 'agency-a',
    }
    expect(() => assertAgencyOwner(owner)).not.toThrow()
    expect(() => assertAgencyOperator(owner)).not.toThrow()
    expect(() => assertAgencyOperator(admin)).not.toThrow()
    expect(() => assertAgencyOwner(admin)).toThrow(AccessError)
  })
})
