import type { Contact, Ticket } from '@prisma/client'
import { z } from 'zod'
import { AccessError } from '@/lib/auth/access-error'
import { assertTenantAction } from '@/lib/auth/policy'
import type { TenantContext } from '@/lib/auth/tenant-context'

export type ContactWithTicketValues = Contact & {
  Ticket: Pick<Ticket, 'value'>[]
}

export type CreateContactInput = {
  email: string
  name: string
  subaccountId: string
}

export type UpdateContactInput = CreateContactInput & {
  contactId: string
}

type ContactValues = {
  email: string
  name: string
}

export type ContactStore = {
  create: (subaccountId: string, values: ContactValues) => Promise<Contact>
  list: (
    subaccountId: string,
    limit: number
  ) => Promise<ContactWithTicketValues[]>
  search: (
    subaccountId: string,
    searchTerm: string,
    limit: number
  ) => Promise<Contact[]>
  update: (
    subaccountId: string,
    contactId: string,
    values: ContactValues
  ) => Promise<Contact | null>
}

type ContactServiceDependencies = {
  resolveContext: (subaccountId: string) => Promise<TenantContext>
  store: ContactStore
}

const createContactSchema = z
  .object({
    email: z.string().trim().email().max(320),
    name: z.string().trim().min(1).max(120),
    subaccountId: z.string().trim().min(1).max(128),
  })
  .strict()

const updateContactSchema = createContactSchema.extend({
  contactId: z.string().uuid(),
})

const subaccountSelectorSchema = z.string().trim().min(1).max(128)

const contactSearchSchema = z
  .union([z.string().max(120), z.null(), z.undefined()])
  .transform((value) => value?.trim() ?? '')

export const createContactService = ({
  resolveContext,
  store,
}: ContactServiceDependencies) => ({
  list: async (requestedSubaccountId: string) => {
    const subaccountId = subaccountSelectorSchema.parse(requestedSubaccountId)
    const context = await resolveContext(subaccountId)
    assertTenantAction(context, 'contact:list')
    return store.list(context.subaccountId, 250)
  },

  search: async (
    requestedSubaccountId: string,
    rawSearchTerm: string | null | undefined
  ) => {
    const subaccountId = subaccountSelectorSchema.parse(requestedSubaccountId)
    const searchTerm = contactSearchSchema.parse(rawSearchTerm)
    const context = await resolveContext(subaccountId)
    assertTenantAction(context, 'contact:search')
    if (!searchTerm) return []
    return store.search(context.subaccountId, searchTerm, 25)
  },

  create: async (rawInput: CreateContactInput) => {
    const input = createContactSchema.parse(rawInput)
    const context = await resolveContext(input.subaccountId)
    assertTenantAction(context, 'contact:create')
    const { email, name } = input
    const values = { email, name }
    return store.create(context.subaccountId, values)
  },

  update: async (rawInput: UpdateContactInput) => {
    const input = updateContactSchema.parse(rawInput)
    const context = await resolveContext(input.subaccountId)
    assertTenantAction(context, 'contact:update')
    const { contactId, email, name } = input
    const updatedContact = await store.update(
      context.subaccountId,
      contactId,
      { email, name }
    )
    if (!updatedContact) throw new AccessError('RESOURCE_NOT_FOUND')
    return updatedContact
  },
})
