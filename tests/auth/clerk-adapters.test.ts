import { describe, expect, test } from 'bun:test'
import {
  createClerkIdentityProvider,
  createClerkInvitationProvider,
  createClerkProfileProvider,
} from '../../src/lib/auth/clerk-adapters'

const clerkUser = () => ({
  emailAddresses: [
    {
      emailAddress: 'primary@example.com',
      id: 'email-primary',
      verification: { status: 'verified' },
    },
    {
      emailAddress: 'other@example.com',
      id: 'email-other',
      verification: { status: 'verified' },
    },
  ],
  firstName: 'Crew',
  id: 'provider-a',
  imageUrl: 'https://example.com/avatar.png',
  lastName: 'Member',
  primaryEmailAddressId: 'email-primary',
})

describe('Clerk v6 adapters', () => {
  test('awaits auth and exposes only the immutable provider subject', async () => {
    let calls = 0
    const provider = createClerkIdentityProvider(async () => {
      calls += 1
      return { userId: 'provider-a' }
    })

    await expect(provider()).resolves.toEqual({ subject: 'provider-a' })
    expect(calls).toBe(1)
    await expect(
      createClerkIdentityProvider(async () => ({ userId: null }))()
    ).resolves.toBeNull()
  })

  test('uses only the exact verified primary email for provisioning', async () => {
    const provider = createClerkProfileProvider(async () => clerkUser())
    await expect(provider('provider-a')).resolves.toEqual({
      avatarUrl: 'https://example.com/avatar.png',
      email: 'primary@example.com',
      name: 'Crew Member',
      subject: 'provider-a',
    })

    await expect(provider('provider-b')).resolves.toBeNull()
    await expect(
      createClerkProfileProvider(async () => ({
        ...clerkUser(),
        primaryEmailAddressId: 'missing',
      }))('provider-a')
    ).resolves.toBeNull()
    await expect(
      createClerkProfileProvider(async () => ({
        ...clerkUser(),
        emailAddresses: [
          {
            emailAddress: 'primary@example.com',
            id: 'email-primary',
            verification: { status: 'unverified' },
          },
        ],
      }))('provider-a')
    ).resolves.toBeNull()
  })

  test('awaits the Clerk client and sends no role or agency metadata', async () => {
    const calls: Array<{ method: string; values: unknown }> = []
    let clientCalls = 0
    const provider = createClerkInvitationProvider({
      getClient: async () => {
        clientCalls += 1
        return {
          invitations: {
            createInvitation: async (values) => {
              calls.push({ method: 'create', values })
              return { id: 'invitation-a' }
            },
            revokeInvitation: async (values) => {
              calls.push({ method: 'revoke', values })
            },
          },
        }
      },
      getRedirectUrl: () => 'https://crewframe.example/agency',
    })

    await expect(
      provider.createInvitation('member@example.com')
    ).resolves.toBe('invitation-a')
    await provider.revokeInvitation('invitation-a')

    expect(clientCalls).toBe(2)
    expect(calls).toEqual([
      {
        method: 'create',
        values: {
          emailAddress: 'member@example.com',
          publicMetadata: { throughInvitation: true },
          redirectUrl: 'https://crewframe.example/agency',
        },
      },
      { method: 'revoke', values: 'invitation-a' },
    ])
  })

  test('does not create a client when the redirect URL is unavailable', async () => {
    let clientCalls = 0
    const provider = createClerkInvitationProvider({
      getClient: async () => {
        clientCalls += 1
        throw new Error('must not run')
      },
      getRedirectUrl: () => undefined,
    })

    await expect(
      provider.createInvitation('member@example.com')
    ).rejects.toThrow('NEXT_PUBLIC_URL is not configured')
    expect(clientCalls).toBe(0)
  })
})
