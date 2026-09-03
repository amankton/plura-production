import 'server-only'

import { db } from '@/lib/db'
import { getTenantContext } from '@/lib/auth/server-tenant-context'
import {
  createContactService,
  type ContactStore,
} from './contact-service'
import { createPublicLeadService } from './public-lead-service'
import {
  buildContactListArgs,
  buildContactSearchArgs,
  buildContactUpdateWhere,
} from './contact-query-scope'

const contactStore: ContactStore = {
  create: (subaccountId, values) =>
    db.contact.create({
      data: {
        ...values,
        subAccountId: subaccountId,
      },
    }),
  list: (subaccountId, limit) =>
    db.contact.findMany(buildContactListArgs(subaccountId, limit)),
  search: (subaccountId, searchTerm, limit) =>
    db.contact.findMany(
      buildContactSearchArgs(subaccountId, searchTerm, limit)
    ),
  update: async (subaccountId, contactId, values) => {
    const result = await db.contact.updateMany({
      where: buildContactUpdateWhere(subaccountId, contactId),
      data: values,
    })

    if (result.count !== 1) return null

    return db.contact.findFirst({
      where: buildContactUpdateWhere(subaccountId, contactId),
    })
  },
}

export const contactService = createContactService({
  resolveContext: getTenantContext,
  store: contactStore,
})

export const publicLeadService = createPublicLeadService({
  create: contactStore.create,
  resolvePublishedFunnel: async (funnelId) => {
    const funnel = await db.funnel.findFirst({
      where: {
        id: funnelId,
        published: true,
      },
      select: { subAccountId: true },
    })

    return funnel ? { subaccountId: funnel.subAccountId } : null
  },
})
