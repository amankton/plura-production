import { Role } from '@prisma/client'
import { AccessError } from './access-error'
import type { TenantContext } from './tenant-context'

export type TenantAction =
  | 'contact:list'
  | 'contact:search'
  | 'contact:create'
  | 'contact:update'

const roleActions: Readonly<Record<Role, readonly TenantAction[]>> = {
  [Role.AGENCY_OWNER]: [
    'contact:list',
    'contact:search',
    'contact:create',
    'contact:update',
  ],
  [Role.AGENCY_ADMIN]: [
    'contact:list',
    'contact:search',
    'contact:create',
    'contact:update',
  ],
  [Role.SUBACCOUNT_USER]: [
    'contact:list',
    'contact:search',
    'contact:create',
    'contact:update',
  ],
  [Role.SUBACCOUNT_GUEST]: ['contact:list', 'contact:search'],
}

export const canPerformTenantAction = (
  context: TenantContext,
  action: TenantAction
) => roleActions[context.actor.role].includes(action)

export const assertTenantAction = (
  context: TenantContext,
  action: TenantAction
) => {
  if (!canPerformTenantAction(context, action)) {
    throw new AccessError('FORBIDDEN')
  }
}
