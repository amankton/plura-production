'use client'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { pricingCards } from '@/lib/constants'
import { useModal } from '@/providers/modal-provider'
import type { CrewframePlan } from '@/lib/stripe/billing-catalog'
import { StripeElementsOptions } from '@stripe/stripe-js'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe/stripe-client'
import Loading from '@/components/global/loading'
import SubscriptionForm from '.'

type Props = {
  customerId: string
  planExists: boolean
}

const SubscriptionFormWrapper = ({ customerId, planExists }: Props) => {
  const { data, setClose } = useModal()
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<CrewframePlan | null>(
    data?.plans?.defaultPlan ?? null
  )
  const [subscription, setSubscription] = useState<{
    subscriptionId: string
    clientSecret: string
  }>({ subscriptionId: '', clientSecret: '' })

  const options: StripeElementsOptions = useMemo(
    () => ({
      clientSecret: subscription?.clientSecret,
      appearance: {
        theme: 'flat',
      },
    }),
    [subscription]
  )

  useEffect(() => {
    if (!selectedPlan) return
    const createSecret = async () => {
      const subscriptionResponse = await fetch(
        '/api/stripe/create-subscription',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerId,
            plan: selectedPlan,
          }),
        }
      )
      const subscriptionResponseData = await subscriptionResponse.json()
      setSubscription({
        clientSecret: subscriptionResponseData.clientSecret,
        subscriptionId: subscriptionResponseData.subscriptionId,
      })
      if (planExists) {
        toast({
          title: 'Success',
          description: 'Your plan has been successfully upgraded!',
        })
        setClose()
        router.refresh()
      }
    }
    createSecret()
  }, [customerId, planExists, router, selectedPlan, setClose])

  return (
    <div className="border-none transition-all">
      <div className="flex flex-col gap-4">
        {data.plans?.plans.map((price) => (
          <Card
            onClick={() => setSelectedPlan(price.plan)}
            key={price.plan}
            className={clsx('relative cursor-pointer transition-all', {
              'border-primary': selectedPlan === price.plan,
            })}
          >
            <CardHeader>
              <CardTitle>
                ${price.unitAmount / 100}
                <p className="text-sm text-muted-foreground">
                  {pricingCards.find((card) => card.plan === price.plan)?.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {
                    pricingCards.find((p) => p.plan === price.plan)
                      ?.description
                  }
                </p>
              </CardTitle>
            </CardHeader>
            {selectedPlan === price.plan && (
              <div className="w-2 h-2 bg-emerald-500 rounded-full absolute top-4 right-4" />
            )}
          </Card>
        ))}

        {options.clientSecret && !planExists && selectedPlan && (
          <>
            <h1 className="text-xl">Payment Method</h1>
            <Elements
              stripe={getStripe()}
              options={options}
            >
              <SubscriptionForm selectedPlan={selectedPlan} />
            </Elements>
          </>
        )}

        {!options.clientSecret && selectedPlan && (
          <div className="flex items-center justify-center w-full h-40">
            <Loading />
          </div>
        )}
      </div>
    </div>
  )
}

export default SubscriptionFormWrapper
