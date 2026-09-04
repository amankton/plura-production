import Unauthorized from '@/components/unauthorized'
import { verifyAndAcceptInvitation } from '@/features/accounts/actions'
import { agencyProjectionService } from '@/features/agency-projections/server-projection-service'
import { AccessError } from '@/lib/auth/access-error'
import { redirect } from 'next/navigation'
import React from 'react'

const SubAccountMainPage = async () => {
  const agencyId = await verifyAndAcceptInvitation()

  if (!agencyId) {
    return <Unauthorized />
  }

  let projection: Readonly<{ subaccountId: string }>
  try {
    projection =
      await agencyProjectionService.getDefaultSubaccountRedirectProjection()
  } catch (error) {
    if (error instanceof AccessError) return <Unauthorized />
    throw error
  }
  return redirect(`/subaccount/${projection.subaccountId}`)
}

export default SubAccountMainPage
