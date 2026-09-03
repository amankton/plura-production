import type { Prisma } from '@prisma/client'

export const buildContactListArgs = (subaccountId: string, limit: number) =>
  ({
    where: { subAccountId: subaccountId },
    include: {
      Ticket: {
        select: { value: true },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  }) satisfies Prisma.ContactFindManyArgs

export const buildContactSearchArgs = (
  subaccountId: string,
  searchTerm: string,
  limit: number
) =>
  ({
    where: {
      subAccountId: subaccountId,
      name: { contains: searchTerm },
    },
    take: limit,
  }) satisfies Prisma.ContactFindManyArgs

export const buildContactUpdateWhere = (
  subaccountId: string,
  contactId: string
): Prisma.ContactWhereInput => ({
  id: contactId,
  subAccountId: subaccountId,
})
