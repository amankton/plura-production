import InfoBar from '@/components/global/infobar'
import Sidebar from '@/components/sidebar'
import Unauthorized from '@/components/unauthorized'
import { verifyAndAcceptInvitation } from '@/features/accounts/actions'
import { notificationViewService } from '@/features/notifications/server-notification-view-service'
import { redirect } from 'next/navigation'
import React from 'react'

type Props = {
  children: React.ReactNode
  params: { subaccountId: string }
}

const SubaccountLayout = async ({ children, params }: Props) => {
  const agencyId = await verifyAndAcceptInvitation()
  if (!agencyId) return <Unauthorized />
  const projection = await notificationViewService.getSubaccountFeed(
    params.subaccountId
  )

  return (
    <div className="h-screen overflow-hidden">
      <Sidebar
        id={params.subaccountId}
        type="subaccount"
      />

      <div className="md:pl-[300px]">
        <InfoBar
          notifications={projection.notifications}
          role={projection.viewerRole}
          subAccountId={params.subaccountId}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  )
}

export default SubaccountLayout
