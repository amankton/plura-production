import BlurPage from '@/components/global/blur-page'
import InfoBar from '@/components/global/infobar'
import Sidebar from '@/components/sidebar'
import Unauthorized from '@/components/unauthorized'
import {
  getNotificationAndUser,
} from '@/lib/queries'
import { verifyAndAcceptInvitation } from '@/features/accounts/actions'
import {
  assertAgencyOperator,
} from '@/lib/auth/agency-context'
import { getAgencyContext } from '@/lib/auth/server-agency-context'
import { redirect } from 'next/navigation'
import React from 'react'

type Props = {
  children: React.ReactNode
  params: { agencyId: string }
}

const layout = async ({ children, params }: Props) => {
  const agencyId = await verifyAndAcceptInvitation()
  if (!agencyId) {
    return redirect('/agency')
  }
  const context = await getAgencyContext(params.agencyId)
  try {
    assertAgencyOperator(context)
  } catch {
    return <Unauthorized />
  }

  let allNoti: any = []
  const notifications = await getNotificationAndUser(context.agencyId)
  if (notifications) allNoti = notifications

 

  return (
    <div className="h-screen overflow-hidden">
      <Sidebar
        id={params.agencyId}
        type="agency"
      />
      <div className="md:pl-[300px]">
        <InfoBar
          notifications={allNoti}
          role={allNoti.User?.role}
        />
        <div className="relative">
          <BlurPage>{children}</BlurPage>
        </div>
      </div>
    </div>
  )
}

export default layout
