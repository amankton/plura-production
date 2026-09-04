'use server'

import { agencyProjectionService } from './server-projection-service'

export const listTicketAssigneeOptions = (subaccountId: string) =>
  agencyProjectionService.listTicketAssigneeOptions(subaccountId)
