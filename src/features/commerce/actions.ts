'use server'

import { commerceService } from './server-commerce-service'
import type { ConfigureFunnelProductsInput } from './commerce-service'

export const configureFunnelProducts = (
  input: ConfigureFunnelProductsInput
) => commerceService.configureFunnelProducts(input)

export const listConnectedProducts = (subaccountId: string) =>
  commerceService.listConnectedProducts(subaccountId)
