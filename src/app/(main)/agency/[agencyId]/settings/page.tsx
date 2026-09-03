import AgencyDetails from '@/components/forms/agency-details'
import UserDetails from '@/components/forms/user-details'
import { db } from '@/lib/db'
import { getAgencyContext } from '@/lib/auth/server-agency-context'
import { assertAgencyOperator } from '@/lib/auth/agency-context'
import React from 'react'

type Props = {
  params: { agencyId: string }
}

const SettingsPage = async ({ params }: Props) => {
  const context = await getAgencyContext(params.agencyId)
  assertAgencyOperator(context)

  const userDetails = await db.user.findUnique({
    where: { id: context.actor.id },
  })

  if (!userDetails) return null
  const agencyDetails = await db.agency.findUnique({
    where: { id: context.agencyId },
    include: {
      SubAccount: true,
    },
  })

  if (!agencyDetails) return null

  const subAccounts = agencyDetails.SubAccount

  return (
    <div className="flex lg:!flex-row flex-col gap-4">
      <AgencyDetails data={agencyDetails} />
      <UserDetails
        subAccounts={subAccounts}
        userData={userDetails}
      />
    </div>
  )
}

export default SettingsPage
