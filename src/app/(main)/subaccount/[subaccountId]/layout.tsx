import InfoBar from '@/components/global/infobar'
import Sidebar from '@/components/sidebar'
import Unauthorized from '@/components/unauthorized'
import {
  getNotificationAndUser,
} from '@/lib/queries'
import { verifyAndAcceptInvitation } from '@/features/accounts/actions'
import { getTenantContext } from '@/lib/auth/server-tenant-context'
import { Role } from '@prisma/client'
import { redirect } from 'next/navigation'
import React from 'react'

type Props = {
  children: React.ReactNode
  params: { subaccountId: string }
}

const SubaccountLayout = async ({ children, params }: Props) => {
  const agencyId = await verifyAndAcceptInvitation()
  if (!agencyId) return <Unauthorized />
  let notifications: any = []
  const context = await getTenantContext(params.subaccountId)
  const allNotifications = await getNotificationAndUser(context.agencyId)

  if (
    context.actor.role === Role.AGENCY_ADMIN ||
    context.actor.role === Role.AGENCY_OWNER
  ) {
    notifications = allNotifications
  } else {
    const filteredNoti = allNotifications?.filter(
      (item) => item.subAccountId === params.subaccountId
    )
    if (filteredNoti) notifications = filteredNoti
  }

  return (
    <div className="h-screen overflow-hidden">
      <Sidebar
        id={params.subaccountId}
        type="subaccount"
      />

      <div className="md:pl-[300px]">
        <InfoBar
          notifications={notifications}
          role={context.actor.role}
          subAccountId={params.subaccountId as string}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  )
} 

export default SubaccountLayout
