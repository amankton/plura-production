import Unauthorized from '@/components/unauthorized'
import { getAuthUserDetails } from '@/lib/queries'
import { verifyAndAcceptInvitation } from '@/features/accounts/actions'
import { redirect } from 'next/navigation'
import React from 'react'

const SubAccountMainPage = async () => {
  const agencyId = await verifyAndAcceptInvitation()

  if (!agencyId) {
    return <Unauthorized />
  }

  const user = await getAuthUserDetails()
  if (!user) return

  const getFirstSubaccountWithAccess = user.Permissions.find(
    (permission) => permission.access === true
  )

  if (getFirstSubaccountWithAccess) {
    return redirect(`/subaccount/${getFirstSubaccountWithAccess.subAccountId}`)
  }

  return <Unauthorized />
}

export default SubAccountMainPage
