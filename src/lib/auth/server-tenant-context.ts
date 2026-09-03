import 'server-only'

import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { clerkIdentityProvider } from './clerk-identity'
import {
  resolveTenantContext,
  type TenantRepository,
} from './tenant-context'

const tenantRepository: TenantRepository = {
  findActorByProviderSubject: async (providerSubject) => {
    const user = await db.user.findUnique({
      where: { id: providerSubject },
      select: {
        id: true,
        agencyId: true,
        role: true,
        Permissions: {
          select: {
            access: true,
            subAccountId: true,
            SubAccount: {
              select: { agencyId: true },
            },
          },
        },
      },
    })

    if (!user) return null

    return {
      agencyId: user.agencyId,
      id: user.id,
      role: user.role,
      permissions: user.Permissions.map((permission) => ({
        access: permission.access,
        agencyId: permission.SubAccount?.agencyId ?? null,
        subaccountId: permission.subAccountId,
      })),
    }
  },
  findSubaccountById: (subaccountId) =>
    db.subAccount.findUnique({
      where: { id: subaccountId },
      select: { agencyId: true, id: true },
    }),
}

const correlationIdPattern = /^[A-Za-z0-9._:-]{1,128}$/

const getCorrelationId = async () => {
  const requestHeaders = await headers()
  const candidate = requestHeaders.get('x-correlation-id')
  return candidate && correlationIdPattern.test(candidate)
    ? candidate
    : randomUUID()
}

export const getTenantContext = async (requestedSubaccountId: string) =>
  resolveTenantContext({
    correlationId: await getCorrelationId(),
    identityProvider: clerkIdentityProvider,
    repository: tenantRepository,
    requestedSubaccountId,
  })
