import type { Contact } from '@prisma/client'
import { z } from 'zod'
import { AccessError } from '@/lib/auth/access-error'

export type PublicLeadInput = {
  email: string
  funnelId: string
  name: string
}

type PublicLeadStore = {
  create: (
    subaccountId: string,
    values: { email: string; name: string }
  ) => Promise<Contact>
  resolvePublishedFunnel: (
    funnelId: string
  ) => Promise<{ subaccountId: string } | null>
}

const publicLeadSchema = z
  .object({
    email: z.string().trim().email().max(320),
    funnelId: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(120),
  })
  .strict()

export const createPublicLeadService = (store: PublicLeadStore) => ({
  submit: async (rawInput: PublicLeadInput) => {
    const { email, funnelId, name } = publicLeadSchema.parse(rawInput)
    const funnel = await store.resolvePublishedFunnel(funnelId)
    if (!funnel) throw new AccessError('RESOURCE_NOT_FOUND')

    return store.create(funnel.subaccountId, { email, name })
  },
})
