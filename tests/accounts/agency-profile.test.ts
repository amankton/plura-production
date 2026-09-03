import { describe, expect, test } from 'bun:test'
import { ZodError } from 'zod'
import { agencyProfileInputSchema } from '../../src/features/accounts/agency-profile'

const validProfile = {
  address: '1 Main Street',
  agencyLogo: 'https://example.com/logo.png',
  city: 'Los Angeles',
  companyPhone: '+1 555 0100',
  country: 'US',
  id: '80e03553-bc35-4e95-9b35-3c1020bfa0c5',
  name: 'Crewframe Agency',
  state: 'CA',
  whiteLabel: true,
  zipCode: '90001',
}

describe('agency profile input', () => {
  test('accepts only editable agency profile fields', () => {
    expect(agencyProfileInputSchema.parse(validProfile)).toEqual(validProfile)
  })

  test.each([
    ['customerId', 'cus_injected'],
    ['connectAccountId', 'acct_injected'],
    ['companyEmail', 'other@example.com'],
    ['createdAt', new Date()],
    ['goal', 999],
  ])('rejects provider-owned field %s', (field, value) => {
    expect(() =>
      agencyProfileInputSchema.parse({ ...validProfile, [field]: value })
    ).toThrow(ZodError)
  })
})
