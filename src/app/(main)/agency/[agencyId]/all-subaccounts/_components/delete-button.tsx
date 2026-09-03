'use client'
import {
  deleteSubAccount,
  saveActivityLogsNotification,
} from '@/lib/queries'
import { useRouter } from 'next/navigation'
import React from 'react'

type Props = {
  subaccountId: string
}

const DeleteButton = ({ subaccountId }: Props) => {
  const router = useRouter()

  return (
    <div
      className="text-white"
      onClick={async () => {
        const response = await deleteSubAccount(subaccountId)
        await saveActivityLogsNotification({
          agencyId: response.agencyId,
          description: `Deleted a subaccount | ${response.name}`,
          subaccountId: undefined,
        })
        router.refresh()
      }}
    >
      Delete Sub Account
    </div>
  )
}

export default DeleteButton
