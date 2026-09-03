import { describe, expect, test } from 'bun:test'
import { Role } from '@prisma/client'
import { AccessError } from '../../src/lib/auth/access-error'
import {
  assertTenantAction,
  canPerformTenantAction,
} from '../../src/lib/auth/policy'
import type { TenantContext } from '../../src/lib/auth/tenant-context'

const contextFor = (role: Role): TenantContext => ({
  actor: { id: 'user-a', providerSubject: 'user-a', role },
  agencyId: 'agency-a',
  correlationId: 'correlation-a',
  scope: { subaccountIds: ['sub-a'] },
  subaccountId: 'sub-a',
})

describe('contact action policy', () => {
  test.each([Role.AGENCY_OWNER, Role.AGENCY_ADMIN, Role.SUBACCOUNT_USER])(
    '%s can perform every authenticated contact action',
    (role) => {
      const context = contextFor(role)
      expect(canPerformTenantAction(context, 'contact:list')).toBe(true)
      expect(canPerformTenantAction(context, 'contact:search')).toBe(true)
      expect(canPerformTenantAction(context, 'contact:create')).toBe(true)
      expect(canPerformTenantAction(context, 'contact:update')).toBe(true)
    }
  )

  test('guest access is explicitly read-only', () => {
    const context = contextFor(Role.SUBACCOUNT_GUEST)
    expect(canPerformTenantAction(context, 'contact:list')).toBe(true)
    expect(canPerformTenantAction(context, 'contact:search')).toBe(true)
    expect(() => assertTenantAction(context, 'contact:create')).toThrow(
      AccessError
    )
    expect(() => assertTenantAction(context, 'contact:update')).toThrow(
      AccessError
    )
    expect(() => assertTenantAction(context, 'commerce:catalog')).toThrow(
      AccessError
    )
    expect(() => assertTenantAction(context, 'commerce:checkout')).toThrow(
      AccessError
    )
    expect(() => assertTenantAction(context, 'commerce:configure')).toThrow(
      AccessError
    )
    expect(() => assertTenantAction(context, 'commerce:metrics')).toThrow(
      AccessError
    )
  })

  test.each([Role.AGENCY_OWNER, Role.AGENCY_ADMIN, Role.SUBACCOUNT_USER])(
    '%s can use authenticated connected commerce',
    (role) => {
      const context = contextFor(role)
      expect(canPerformTenantAction(context, 'commerce:catalog')).toBe(true)
      expect(canPerformTenantAction(context, 'commerce:checkout')).toBe(true)
      expect(canPerformTenantAction(context, 'commerce:configure')).toBe(true)
      expect(canPerformTenantAction(context, 'commerce:metrics')).toBe(true)
    }
  )

  test.each([Role.AGENCY_OWNER, Role.AGENCY_ADMIN])(
    '%s can manage subaccounts',
    (role) => {
      expect(canPerformTenantAction(contextFor(role), 'subaccount:manage')).toBe(
        true
      )
    }
  )

  test.each([Role.SUBACCOUNT_USER, Role.SUBACCOUNT_GUEST])(
    '%s cannot manage subaccounts',
    (role) => {
      expect(canPerformTenantAction(contextFor(role), 'subaccount:manage')).toBe(
        false
      )
    }
  )
})
