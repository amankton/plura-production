import SubAccountDetails from '@/components/forms/subaccount-details'
import UserDetails from '@/components/forms/user-details'
import BlurPage from '@/components/global/blur-page'
import { db } from '@/lib/db'
import { getTenantContext } from '@/lib/auth/server-tenant-context'
import React from 'react'

type Props = {
  params: { subaccountId: string }
}

const SubaccountSettingPage = async ({ params }: Props) => {
  const context = await getTenantContext(params.subaccountId)
  const userDetails = await db.user.findUnique({
    where: { id: context.actor.id },
  })
  if (!userDetails) return

  const subAccount = await db.subAccount.findFirst({
    where: { agencyId: context.agencyId, id: context.subaccountId },
  })
  if (!subAccount) return

  const agencyDetails = await db.agency.findUnique({
    where: { id: context.agencyId },
    include: { SubAccount: true },
  })

  if (!agencyDetails) return
  const subAccounts = agencyDetails.SubAccount

  return (
    <BlurPage>
      <div className="flex lg:!flex-row flex-col gap-4">
        <SubAccountDetails
          agencyDetails={agencyDetails}
          details={subAccount}
          userId={userDetails.id}
          userName={userDetails.name}
        />
      <UserDetails
          subAccounts={subAccounts}
          userData={userDetails}
        />
      </div>
    </BlurPage>
  )
}

export default SubaccountSettingPage
