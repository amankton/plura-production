import { agencyProjectionService } from '@/features/agency-projections/server-projection-service'
import React from 'react'
import MenuOptions from './menu-options'

type Props = {
  id: string
  type: 'agency' | 'subaccount'
}

const Sidebar = async ({ id, type }: Props) => {
  const projection =
    type === 'agency'
      ? await agencyProjectionService.getAgencySidebarProjection(id)
      : await agencyProjectionService.getSubaccountSidebarProjection(id)
  const details =
    projection.kind === 'agency'
      ? projection.agency
      : projection.currentSubaccount
  let sideBarLogo = projection.agency.agencyLogo || '/assets/plura-logo.svg'
  if (!projection.agency.whiteLabel && projection.kind === 'subaccount') {
    sideBarLogo =
      projection.currentSubaccount.subAccountLogo || projection.agency.agencyLogo
  }

  return (
    <>
      <MenuOptions
        defaultOpen={true}
        actor={projection.actor}
        agency={projection.agency}
        details={details}
        legacyActivityActorName={projection.legacyActivityActorName}
        sidebarLogo={sideBarLogo}
        sidebarOpt={projection.sidebarOptions}
        subAccounts={projection.subaccounts}
      />
      <MenuOptions
        actor={projection.actor}
        agency={projection.agency}
        details={details}
        legacyActivityActorName={projection.legacyActivityActorName}
        sidebarLogo={sideBarLogo}
        sidebarOpt={projection.sidebarOptions}
        subAccounts={projection.subaccounts}
      />
    </>
  )
}

export default Sidebar
