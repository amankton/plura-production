import { z } from 'zod'

export const agencyProfileInputSchema = z
  .object({
    address: z.string().trim().min(1).max(240),
    agencyLogo: z.string().trim().url().max(2048),
    city: z.string().trim().min(1).max(120),
    companyPhone: z.string().trim().min(1).max(40),
    country: z.string().trim().min(1).max(120),
    id: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    state: z.string().trim().min(1).max(120),
    whiteLabel: z.boolean(),
    zipCode: z.string().trim().min(1).max(32),
  })
  .strict()

export type AgencyProfileInput = z.infer<typeof agencyProfileInputSchema>
