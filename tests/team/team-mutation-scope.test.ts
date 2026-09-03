import { describe, expect, test } from 'bun:test'
import { Role } from '@prisma/client'
import { AccessError } from '../../src/lib/auth/access-error'
import {
  assertManagedRoleTransition,
  assertScopedPermissionSnapshot,
  assertSingleMutation,
  buildMemberMutationWhere,
  buildPermissionMutationWhere,
} from '../../src/features/team/team-mutation-scope'

describe('team persistence mutation scope', () => {
  test('binds a member mutation to id, agency, and expected role', () => {
    expect(
      buildMemberMutationWhere({
        agencyId: 'agency-a',
        expectedRole: Role.SUBACCOUNT_USER,
        memberId: 'member-a',
      })
    ).toEqual({
      agencyId: 'agency-a',
      id: 'member-a',
      role: Role.SUBACCOUNT_USER,
    })
  })

  test('binds a permission mutation to its owner, tenant, and prior state', () => {
    expect(
      buildPermissionMutationWhere({
        email: 'member@example.com',
        expectedAccess: true,
        permissionId: 'permission-a',
        subaccountId: 'subaccount-a',
      })
    ).toEqual({
      access: true,
      email: 'member@example.com',
      id: 'permission-a',
      subAccountId: 'subaccount-a',
    })
  })

  test('rejects owner transitions before persistence', () => {
    expect(() =>
      assertManagedRoleTransition(Role.AGENCY_OWNER, Role.AGENCY_ADMIN)
    ).toThrow(AccessError)
    expect(() =>
      assertManagedRoleTransition(Role.SUBACCOUNT_USER, Role.AGENCY_OWNER)
    ).toThrow(AccessError)
  })

  test('rejects cross-agency and duplicate permission snapshots', () => {
    expect(() =>
      assertScopedPermissionSnapshot(
        [
          {
            access: true,
            id: 'permission-a',
            subaccount: { agencyId: 'agency-b', id: 'subaccount-a' },
          },
        ],
        'agency-a'
      )
    ).toThrow(AccessError)

    expect(() =>
      assertScopedPermissionSnapshot(
        [
          {
            access: true,
            id: 'permission-a',
            subaccount: { agencyId: 'agency-a', id: 'subaccount-a' },
          },
          {
            access: false,
            id: 'permission-b',
            subaccount: { agencyId: 'agency-a', id: 'subaccount-a' },
          },
        ],
        'agency-a'
      )
    ).toThrow(AccessError)
  })

  test('requires exactly one affected row for conditional writes', () => {
    expect(() => assertSingleMutation(1)).not.toThrow()
    expect(() => assertSingleMutation(0)).toThrow(AccessError)
    expect(() => assertSingleMutation(2)).toThrow(AccessError)
  })
})
