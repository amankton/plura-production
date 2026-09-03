'use client'
import SubscriptionFormWrapper from '@/components/forms/subscription-form/subscription-form-wrapper'
import CustomModal from '@/components/global/custom-modal'
import {
  isCrewframePlan,
  type CrewframePriceOption,
} from '@/lib/stripe/billing-catalog'
import { useModal } from '@/providers/modal-provider'
import { useSearchParams } from 'next/navigation'
import React, { useEffect } from 'react'

type Props = {
  prices: CrewframePriceOption[]
  customerId: string
  planExists: boolean
}

const SubscriptionHelper = ({ customerId, planExists, prices }: Props) => {
  const { setOpen } = useModal()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan')

  useEffect(() => {
    if (isCrewframePlan(plan))
      setOpen(
        <CustomModal
          title="Upgrade Plan!"
          subheading="Get started today to get access to premium features"
        >
          <SubscriptionFormWrapper
            planExists={planExists}
            customerId={customerId}
          />
        </CustomModal>,
        async () => ({
          plans: {
            defaultPlan: plan,
            plans: prices,
          },
        })
      )
  }, [customerId, plan, planExists, prices, setOpen])

  return <div>SubscriptionHelper</div>
}

export default SubscriptionHelper
