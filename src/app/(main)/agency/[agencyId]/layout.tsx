import BlurPage from '@/components/global/blur-page'
import InfoBar from '@/components/global/infobar'
import Sidebar from '@/components/sidebar'
import Unauthorized from '@/components/unauthorized'
import { verifyAndAcceptInvitation } from '@/features/accounts/actions'
import { notificationViewService } from '@/features/notifications/server-notification-view-service'
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
  const projection = await notificationViewService
    .getAgencyFeed(params.agencyId)
    .catch(() => null)
  if (!projection) return <Unauthorized />

  return (
    <div className="h-screen overflow-hidden">
      <Sidebar
        id={params.agencyId}
        type="agency"
      />
      <div className="md:pl-[300px]">
        <InfoBar
          notifications={projection.notifications}
          role={projection.viewerRole}
        />
        <div className="relative">
          <BlurPage>{children}</BlurPage>
        </div>
      </div>
    </div>
  )
}

export default layout
