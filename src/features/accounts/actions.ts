'use server'

import { redirect } from 'next/navigation'
import { AccessError } from '@/lib/auth/access-error'
import { accountService } from './server-account-service'

export async function verifyAndAcceptInvitation() {
  try {
    return await accountService.resolveAccountEntry()
  } catch (error) {
    if (error instanceof AccessError && error.code === 'UNAUTHENTICATED') {
      redirect('/sign-in')
    }
    throw error
  }
}

export async function provisionAgencyOwner() {
  return accountService.provisionAgencyOwner()
}
