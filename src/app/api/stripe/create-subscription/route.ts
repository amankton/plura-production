import { billingService } from '@/features/billing/server-billing-service'
import {
  getRequestCorrelationId,
  readTrustedJsonRequest,
  safeHttpError,
} from '@/lib/http/request-integrity'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const correlationId = getRequestCorrelationId(req)
  try {
    const result = await billingService.createOrChangeSubscription(
      await readTrustedJsonRequest(req)
    )
    return NextResponse.json(result, {
      headers: { 'x-correlation-id': correlationId },
    })
  } catch (error) {
    const response = safeHttpError(error)
    console.error('Stripe subscription request failed', {
      correlationId,
      status: response.status,
    })
    return NextResponse.json(
      { error: response.message },
      {
        headers: { 'x-correlation-id': correlationId },
        status: response.status,
      }
    )
  }
}
