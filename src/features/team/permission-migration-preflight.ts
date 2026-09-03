export type PreflightUser = {
  agencyId: string | null
  email: string
  id: string
}

export type PreflightSubaccount = {
  agencyId: string
  id: string
}

export type PreflightPermission = {
  access: boolean
  email: string
  id: string
  subaccountId: string
}

type PreflightInput = {
  permissions: readonly PreflightPermission[]
  providerSubjects?: ReadonlySet<string>
  subaccounts: readonly PreflightSubaccount[]
  users: readonly PreflightUser[]
}

export type PermissionMigrationPreflightReport = {
  counts: {
    permissions: number
    subaccounts: number
    users: number
  }
  crossAgency: readonly {
    memberRef: string
    permissionRef: string
    subaccountRef: string
  }[]
  duplicateGroups: readonly {
    conflicting: boolean
    count: number
    memberRef: string
    permissionRefs: readonly string[]
    subaccountRef: string
  }[]
  missingProviderMappings: readonly { memberRef: string }[] | null
  orphanedUsers: readonly { memberRef: string }[]
  unmatchedPermissions: readonly {
    permissionRef: string
    reason: 'SUBACCOUNT_NOT_FOUND' | 'USER_NOT_FOUND'
  }[]
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const analyzePermissionMigration = ({
  permissions,
  providerSubjects,
  subaccounts,
  users,
}: PreflightInput): PermissionMigrationPreflightReport => {
  const usersByEmail = new Map<string, PreflightUser[]>()
  for (const user of users) {
    const key = normalizeEmail(user.email)
    usersByEmail.set(key, [...(usersByEmail.get(key) ?? []), user])
  }
  const subaccountsById = new Map(
    subaccounts.map((subaccount) => [subaccount.id, subaccount])
  )
  const groupedPermissions = new Map<string, PreflightPermission[]>()
  const unmatchedPermissions: PermissionMigrationPreflightReport['unmatchedPermissions'][number][] =
    []
  const crossAgency: PermissionMigrationPreflightReport['crossAgency'][number][] =
    []

  for (const permission of permissions) {
    const matchingUsers = usersByEmail.get(normalizeEmail(permission.email)) ?? []
    const targetSubaccount = subaccountsById.get(permission.subaccountId)
    if (matchingUsers.length !== 1) {
      unmatchedPermissions.push({
        permissionRef: permission.id,
        reason: 'USER_NOT_FOUND',
      })
      continue
    }
    if (!targetSubaccount) {
      unmatchedPermissions.push({
        permissionRef: permission.id,
        reason: 'SUBACCOUNT_NOT_FOUND',
      })
      continue
    }

    const targetUser = matchingUsers[0]
    if (
      !targetUser.agencyId ||
      targetUser.agencyId !== targetSubaccount.agencyId
    ) {
      crossAgency.push({
        memberRef: targetUser.id,
        permissionRef: permission.id,
        subaccountRef: targetSubaccount.id,
      })
    }

    const groupKey = `${targetUser.id}\u0000${targetSubaccount.id}`
    groupedPermissions.set(groupKey, [
      ...(groupedPermissions.get(groupKey) ?? []),
      permission,
    ])
  }

  const duplicateGroups = Array.from(groupedPermissions.entries())
    .filter(([, records]) => records.length > 1)
    .map(([key, records]) => {
      const [memberRef, subaccountRef] = key.split('\u0000')
      return {
        conflicting: new Set(records.map((record) => record.access)).size > 1,
        count: records.length,
        memberRef,
        permissionRefs: records.map((record) => record.id).sort(),
        subaccountRef,
      }
    })
    .sort((a, b) =>
      `${a.memberRef}:${a.subaccountRef}`.localeCompare(
        `${b.memberRef}:${b.subaccountRef}`
      )
    )

  return {
    counts: {
      permissions: permissions.length,
      subaccounts: subaccounts.length,
      users: users.length,
    },
    crossAgency: crossAgency.sort((a, b) =>
      a.permissionRef.localeCompare(b.permissionRef)
    ),
    duplicateGroups,
    missingProviderMappings: providerSubjects
      ? users
          .filter((user) => !providerSubjects.has(user.id))
          .map((user) => ({ memberRef: user.id }))
          .sort((a, b) => a.memberRef.localeCompare(b.memberRef))
      : null,
    orphanedUsers: users
      .filter((user) => !user.agencyId)
      .map((user) => ({ memberRef: user.id }))
      .sort((a, b) => a.memberRef.localeCompare(b.memberRef)),
    unmatchedPermissions: unmatchedPermissions.sort((a, b) =>
      a.permissionRef.localeCompare(b.permissionRef)
    ),
  }
}
