import React from 'react'
import { getStripeServerClient } from '@/lib/stripe'
import { addOnProducts, pricingCards } from '@/lib/constants'
import { db } from '@/lib/db'
import { Separator } from '@/components/ui/separator'
import PricingCard from './_components/pricing-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import clsx from 'clsx'
import SubscriptionHelper from './_components/subscription-helper'
import { getExpandedPrice } from '@/lib/stripe/stripe-normalizers'
import { getCrewframePriceOptions } from '@/lib/stripe/billing-catalog-server'
import { resolveLegacyCrewframePlan } from '@/lib/stripe/billing-catalog'
import { getAgencyContext } from '@/lib/auth/server-agency-context'
import { assertAgencyOwner } from '@/lib/auth/agency-context'
import Unauthorized from '@/components/unauthorized'
import { billingService } from '@/features/billing/server-billing-service'

type Props = {
  params: { agencyId: string }
}

const page = async ({ params }: Props) => {
  const context = await getAgencyContext(params.agencyId)
  try {
    assertAgencyOwner(context)
  } catch {
    return <Unauthorized />
  }
  const stripe = getStripeServerClient()
  //CHALLENGE : Create the add on  products
  const addOns = addOnProducts.length
    ? (
        await stripe.products.list({
          ids: addOnProducts.map((product) => product.id),
          expand: ['data.default_price'],
        })
      ).data
    : []

  const agencySubscription = await db.agency.findUnique({
    where: {
      id: context.agencyId,
    },
    select: {
      customerId: true,
      Subscription: true,
    },
  })

  const prices = await getCrewframePriceOptions()

  const currentPlan =
    agencySubscription?.Subscription?.logicalPlan ??
    resolveLegacyCrewframePlan(agencySubscription?.Subscription?.plan)
  const currentPlanDetails = pricingCards.find(
    (card) => card.plan === currentPlan
  )

  const charges = await billingService.listAgencyCharges({
    agencyId: context.agencyId,
  })

  const allCharges = [
    ...charges.map((charge) => ({
      description: charge.description,
      id: charge.id,
      date: `${new Date(charge.created * 1000).toLocaleTimeString()} ${new Date(
        charge.created * 1000
      ).toLocaleDateString()}`,
      status: 'Paid',
      amount: `$${charge.amount / 100}`,
    })),
  ]

  return (
    <>
      <SubscriptionHelper
        prices={prices}
        agencyId={context.agencyId}
        planExists={agencySubscription?.Subscription?.active === true}
      />
      <h1 className="text-4xl p-4">Billing</h1>
      <Separator className=" mb-6" />
      <h2 className="text-2xl p-4">Current Plan</h2>
      <div className="flex flex-col lg:!flex-row justify-between gap-8">
        <PricingCard
          planExists={agencySubscription?.Subscription?.active === true}
          prices={prices}
          agencyId={context.agencyId}
          amt={
            agencySubscription?.Subscription?.active === true
              ? currentPlanDetails?.price || '$0'
              : '$0'
          }
          buttonCta={
            agencySubscription?.Subscription?.active === true
              ? 'Change Plan'
              : 'Get Started'
          }
          highlightDescription="Want to modify your plan? You can do this here. If you have
          further question contact support@plura-app.com"
          highlightTitle="Plan Options"
          description={
            agencySubscription?.Subscription?.active === true
              ? currentPlanDetails?.description || 'Lets get started'
              : 'Lets get started! Pick a plan that works best for you.'
          }
          duration="/ month"
          features={
            agencySubscription?.Subscription?.active === true
              ? currentPlanDetails?.features || []
              : currentPlanDetails?.features ||
                pricingCards.find((pricing) => pricing.title === 'Starter')
                  ?.features ||
                []
          }
          title={
            agencySubscription?.Subscription?.active === true
              ? currentPlanDetails?.title || 'Starter'
              : 'Starter'
          }
        />
        {addOns.map((addOn) => {
          const defaultPrice = getExpandedPrice(addOn)
          return (
            <PricingCard
              planExists={agencySubscription?.Subscription?.active === true}
              prices={prices}
              agencyId={context.agencyId}
              key={addOn.id}
              amt={
                defaultPrice?.unit_amount
                  ? `$${defaultPrice.unit_amount / 100}`
                  : '$0'
              }
              buttonCta="Subscribe"
              description="Dedicated support line & teams channel for support"
              duration="/ month"
              features={[]}
              title={'24/7 priority support'}
              highlightTitle="Get support now!"
              highlightDescription="Get priority support and skip the long long with the click of a button."
            />
          )
        })}
      </div>
      <h2 className="text-2xl p-4">Payment History</h2>
      <Table className="bg-card border-[1px] border-border rounded-md">
        <TableHeader className="rounded-md">
          <TableRow>
            <TableHead className="w-[200px]">Description</TableHead>
            <TableHead className="w-[200px]">Invoice Id</TableHead>
            <TableHead className="w-[300px]">Date</TableHead>
            <TableHead className="w-[200px]">Paid</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="font-medium truncate">
          {allCharges.map((charge) => (
            <TableRow key={charge.id}>
              <TableCell>{charge.description}</TableCell>
              <TableCell className="text-muted-foreground">
                {charge.id}
              </TableCell>
              <TableCell>{charge.date}</TableCell>
              <TableCell>
                <p
                  className={clsx('', {
                    'text-emerald-500': charge.status.toLowerCase() === 'paid',
                    'text-orange-600':
                      charge.status.toLowerCase() === 'pending',
                    'text-red-600': charge.status.toLowerCase() === 'failed',
                  })}
                >
                  {charge.status.toUpperCase()}
                </p>
              </TableCell>
              <TableCell className="text-right">{charge.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}

export default page
