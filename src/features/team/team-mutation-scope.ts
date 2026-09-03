import { Role } from '@prisma/client'
import { AccessError } from '@/lib/auth/access-error'

type PermissionSnapshot = {
  access: boolean
  id: string
  subaccount: {
    agencyId: string | null
    id: string
  }
}

export const buildMemberMutationWhere = (values: {
  agencyId: string
  expectedRole: Role
  memberId: string
}) => ({
  agencyId: values.agencyId,
  id: values.memberId,
  role: values.expectedRole,
})

export const buildPermissionMutationWhere = (values: {
  email: string
  expectedAccess: boolean
  permissionId: string
  subaccountId: string
}) => ({
  access: values.expectedAccess,
  email: values.email,
  id: values.permissionId,
  subAccountId: values.subaccountId,
})

export const assertManagedRoleTransition = (
  expectedRole: Role,
  nextRole: Role
) => {
  if (
    expectedRole === Role.AGENCY_OWNER ||
    nextRole === Role.AGENCY_OWNER
  ) {
    throw new AccessError('FORBIDDEN')
  }
}

export const assertScopedPermissionSnapshot = (
  permissions: readonly PermissionSnapshot[],
  agencyId: string
) => {
  const seenSubaccounts = new Set<string>()
  for (const permission of permissions) {
    if (
      !permission.subaccount.id ||
      permission.subaccount.agencyId !== agencyId
    ) {
      throw new AccessError('FORBIDDEN')
    }
    if (seenSubaccounts.has(permission.subaccount.id)) {
      throw new AccessError('CONFLICT')
    }
    seenSubaccounts.add(permission.subaccount.id)
  }
}

export const assertSingleMutation = (count: number) => {
  if (count !== 1) throw new AccessError('CONFLICT')
}
