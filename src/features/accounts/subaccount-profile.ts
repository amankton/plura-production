import { z } from 'zod'

export const subaccountProfileInputSchema = z
  .object({
    address: z.string().trim().min(1).max(240),
    agencyId: z.string().uuid(),
    city: z.string().trim().min(1).max(120),
    companyEmail: z.string().trim().email().max(320),
    companyPhone: z.string().trim().min(1).max(40),
    country: z.string().trim().min(1).max(120),
    id: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    state: z.string().trim().min(1).max(120),
    subAccountLogo: z.string().trim().url().max(2048),
    zipCode: z.string().trim().min(1).max(32),
  })
  .strict()

export type SubaccountProfileInput = z.infer<
  typeof subaccountProfileInputSchema
>
