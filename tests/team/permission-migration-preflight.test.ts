import { describe, expect, test } from 'bun:test'
import { analyzePermissionMigration } from '../../src/features/team/permission-migration-preflight'

describe('permission migration preflight', () => {
  test('reports duplicates, conflicts, unmatched rows, cross-agency rows, and missing mappings', () => {
    const report = analyzePermissionMigration({
      permissions: [
        {
          access: true,
          email: 'member@example.com',
          id: 'permission-1',
          subaccountId: 'sub-a',
        },
        {
          access: false,
          email: 'MEMBER@example.com',
          id: 'permission-2',
          subaccountId: 'sub-a',
        },
        {
          access: true,
          email: 'missing@example.com',
          id: 'permission-3',
          subaccountId: 'sub-a',
        },
        {
          access: true,
          email: 'member@example.com',
          id: 'permission-4',
          subaccountId: 'sub-missing',
        },
        {
          access: true,
          email: 'cross@example.com',
          id: 'permission-5',
          subaccountId: 'sub-a',
        },
      ],
      providerSubjects: new Set(['member-a']),
      subaccounts: [{ agencyId: 'agency-a', id: 'sub-a' }],
      users: [
        { agencyId: 'agency-a', email: 'member@example.com', id: 'member-a' },
        { agencyId: 'agency-b', email: 'cross@example.com', id: 'member-b' },
        { agencyId: null, email: 'orphan@example.com', id: 'member-c' },
      ],
    })

    expect(report.duplicateGroups).toEqual([
      {
        conflicting: true,
        count: 2,
        memberRef: 'member-a',
        permissionRefs: ['permission-1', 'permission-2'],
        subaccountRef: 'sub-a',
      },
    ])
    expect(report.unmatchedPermissions).toEqual([
      { permissionRef: 'permission-3', reason: 'USER_NOT_FOUND' },
      { permissionRef: 'permission-4', reason: 'SUBACCOUNT_NOT_FOUND' },
    ])
    expect(report.crossAgency).toEqual([
      {
        memberRef: 'member-b',
        permissionRef: 'permission-5',
        subaccountRef: 'sub-a',
      },
    ])
    expect(report.missingProviderMappings).toEqual([
      { memberRef: 'member-b' },
      { memberRef: 'member-c' },
    ])
    expect(report.orphanedUsers).toEqual([{ memberRef: 'member-c' }])
  })

  test('does not expose email addresses in its serialized report', () => {
    const report = analyzePermissionMigration({
      permissions: [
        {
          access: true,
          email: 'secret@example.com',
          id: 'permission-secret',
          subaccountId: 'sub-a',
        },
      ],
      subaccounts: [{ agencyId: 'agency-a', id: 'sub-a' }],
      users: [],
    })
    expect(JSON.stringify(report)).not.toContain('secret@example.com')
    expect(report.missingProviderMappings).toBeNull()
  })
})
