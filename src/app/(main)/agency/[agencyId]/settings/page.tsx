import AgencyDetails from '@/components/forms/agency-details'
import UserDetails from '@/components/forms/user-details'
import { agencyProjectionService } from '@/features/agency-projections/server-projection-service'
import React from 'react'

type Props = {
  params: { agencyId: string }
}

const SettingsPage = async ({ params }: Props) => {
  const projection =
    await agencyProjectionService.getAgencySettingsProjection(params.agencyId)

  return (
    <div className="flex lg:!flex-row flex-col gap-4">
      <AgencyDetails data={projection.agency} />
      <UserDetails
        subAccounts={projection.subaccounts}
        userData={projection.actor}
      />
    </div>
  )
}

export default SettingsPage
