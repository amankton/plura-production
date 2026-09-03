import 'server-only'

import { currentUser } from '@clerk/nextjs/server'
import { InvitationStatus, Role } from '@prisma/client'
import { AccessError } from '@/lib/auth/access-error'
import { createClerkProfileProvider } from '@/lib/auth/clerk-adapters'
import { clerkIdentityProvider } from '@/lib/auth/clerk-identity'
import { db } from '@/lib/db'
import {
  createAccountService,
  type AccountInvitationRecord,
  type AccountStore,
} from './account-service'

const accountStore: AccountStore = {
  acceptInvitation: (values) =>
    db.$transaction(async (transaction) => {
      const invitation = await transaction.invitation.findUnique({
        where: { id: values.invitationId },
      })
      if (
        !invitation ||
        invitation.status !== InvitationStatus.PENDING ||
        invitation.email.toLowerCase() !== values.email.toLowerCase() ||
        invitation.role === Role.AGENCY_OWNER
      ) {
        throw new AccessError('CONFLICT')
      }

      const claimed = await transaction.invitation.deleteMany({
        where: {
          id: invitation.id,
          status: InvitationStatus.PENDING,
        },
      })
      if (claimed.count !== 1) throw new AccessError('CONFLICT')

      return transaction.user.create({
        data: {
          agencyId: invitation.agencyId,
          avatarUrl: values.avatarUrl,
          email: invitation.email,
          id: values.providerSubject,
          name: values.name,
          role: invitation.role,
        },
        select: { agencyId: true, email: true, id: true, role: true },
      })
    }),
  createAgencyOwner: (values) =>
    db.user.create({
      data: {
        avatarUrl: values.avatarUrl,
        email: values.email,
        id: values.providerSubject,
        name: values.name,
        role: Role.AGENCY_OWNER,
      },
      select: { agencyId: true, email: true, id: true, role: true },
    }),
  findPendingInvitationByEmail: async (email) => {
    const invitation = await db.invitation.findFirst({
      where: { email, status: InvitationStatus.PENDING },
    })
    return invitation as AccountInvitationRecord | null
  },
  findUserByEmail: (email) =>
    db.user.findUnique({
      where: { email },
      select: { agencyId: true, email: true, id: true, role: true },
    }),
  findUserByProviderSubject: (providerSubject) =>
    db.user.findUnique({
      where: { id: providerSubject },
      select: { agencyId: true, email: true, id: true, role: true },
    }),
}

export const accountService = createAccountService({
  identityProvider: clerkIdentityProvider,
  profileProvider: createClerkProfileProvider(currentUser),
  store: accountStore,
})
