import React from 'react'
import DataTable from './data-table'
import { Plus } from 'lucide-react'
import { createColumns } from './columns'
import SendInvitation from '@/components/forms/send-invitation'
import { listAgencyTeam } from '@/features/team/actions'
import Unauthorized from '@/components/unauthorized'
import { isAccessError } from '@/lib/auth/access-error'

type Props = {
  params: { agencyId: string }
}

const TeamPage = async ({ params }: Props) => {
  let team
  try {
    team = await listAgencyTeam(params.agencyId)
  } catch (error) {
    if (isAccessError(error)) return <Unauthorized />
    throw error
  }

  return (
    <DataTable
      actionButtonText={
        <>
          <Plus size={15} />
          Add
        </>
      }
      modalChildren={<SendInvitation />}
      filterValue="name"
      columns={createColumns(team.subaccounts)}
      data={[...team.members]}
    ></DataTable>
  )
}

export default TeamPage
