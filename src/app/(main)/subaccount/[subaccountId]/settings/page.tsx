import SubAccountDetails from '@/components/forms/subaccount-details'
import UserDetails from '@/components/forms/user-details'
import BlurPage from '@/components/global/blur-page'
import { agencyProjectionService } from '@/features/agency-projections/server-projection-service'
import React from 'react'

type Props = {
  params: { subaccountId: string }
}

const SubaccountSettingPage = async ({ params }: Props) => {
  const projection =
    await agencyProjectionService.getSubaccountSettingsProjection(
      params.subaccountId
    )

  return (
    <BlurPage>
      <div className="flex lg:!flex-row flex-col gap-4">
        <SubAccountDetails
          agencyDetails={{ id: projection.agency.id }}
          details={projection.details}
        />
        <UserDetails
          subAccounts={projection.subaccounts}
          userData={projection.actor}
        />
      </div>
    </BlurPage>
  )
}

export default SubaccountSettingPage
