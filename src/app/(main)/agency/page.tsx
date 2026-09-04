import AgencyDetails from '@/components/forms/agency-details'
import { verifyAndAcceptInvitation } from '@/features/accounts/actions'
import { agencyProjectionService } from '@/features/agency-projections/server-projection-service'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import React from 'react'

const Page = async ({
  searchParams,
}: {
  searchParams: { plan: string }
}) => {
  await verifyAndAcceptInvitation()
  const entry = await agencyProjectionService.getAccountEntryProjection()
  if (entry.kind === 'ROUTE') {
    if (entry.role === 'SUBACCOUNT_GUEST' || entry.role === 'SUBACCOUNT_USER') {
      return redirect('/subaccount')
    } else if (entry.role === 'AGENCY_OWNER' || entry.role === 'AGENCY_ADMIN') {
      if (searchParams.plan) {
        return redirect(`/agency/${entry.agencyId}/billing?plan=${searchParams.plan}`)
      }
      return redirect(`/agency/${entry.agencyId}`)
    } else {
      return <div>Not authorized</div>
    }
  }
  const authUser = await currentUser()
  return (
    <div className="flex justify-center items-center mt-4">
      <div className="max-w-[850px] border-[1px] p-4 rounded-xl">
        <h1 className="text-4xl"> Create An Agency</h1>
        <AgencyDetails
          data={{ companyEmail: authUser?.emailAddresses[0].emailAddress }}
        />
      </div>
    </div>
  )
}

export default Page
