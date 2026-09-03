import { describe, expect, test } from 'bun:test'
import { subaccountProfileInputSchema } from '../../src/features/accounts/subaccount-profile'

const input = {
  address: '1 Main Street',
  agencyId: '0ec96200-2dac-4eca-84b5-687099e95665',
  city: 'Los Angeles',
  companyEmail: 'client@example.com',
  companyPhone: '+1 555 0100',
  country: 'US',
  id: '3d8c7f41-9d5b-41a4-bce3-d7aabff9e920',
  name: 'Client Account',
  state: 'CA',
  subAccountLogo: 'https://example.com/logo.png',
  zipCode: '90001',
}

describe('subaccount profile input', () => {
  test('accepts only editable subaccount profile fields', () => {
    expect(subaccountProfileInputSchema.parse(input)).toEqual(input)
  })

  test.each([
    ['connectAccountId', 'acct_injected'],
    ['createdAt', new Date()],
    ['goal', 5000],
    ['updatedAt', new Date()],
  ])('rejects provider or server-owned field %s', (field, value) => {
    expect(() =>
      subaccountProfileInputSchema.parse({ ...input, [field]: value })
    ).toThrow()
  })
})
