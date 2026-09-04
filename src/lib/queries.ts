'use server'

import { currentUser } from '@clerk/nextjs/server'
import { db } from './db'
import {
  Lane,
  Prisma,
  Tag,
  Ticket,
} from '@prisma/client'
import { v4 } from 'uuid'
import {
  CreateFunnelFormSchema,
  CreateMediaType,
  UpsertFunnelPage,
} from './types'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { contactService, publicLeadService } from '@/features/contacts/server-contact-service'
import type {
  CreateContactInput,
  UpdateContactInput,
} from '@/features/contacts/contact-service'
import type { PublicLeadInput } from '@/features/contacts/public-lead-service'
import { AccessError } from '@/lib/auth/access-error'
import {
  agencyProfileInputSchema,
  type AgencyProfileInput,
} from '@/features/accounts/agency-profile'
import {
  subaccountProfileInputSchema,
  type SubaccountProfileInput,
} from '@/features/accounts/subaccount-profile'
import { getAgencyContext } from '@/lib/auth/server-agency-context'
import {
  assertAgencyOperator,
  assertAgencyOwner,
} from '@/lib/auth/agency-context'
import { getTenantContext } from '@/lib/auth/server-tenant-context'
import { assertTenantAction } from '@/lib/auth/policy'

const agencyGoalInputSchema = z
  .object({
    agencyId: z.string().uuid(),
    goal: z.number().int().min(1).max(1_000_000),
  })
  .strict()

export const updateAgencyGoal = async (rawInput: unknown) => {
  const input = agencyGoalInputSchema.parse(rawInput)
  const context = await getAgencyContext(input.agencyId)
  assertAgencyOwner(context)
  return db.agency.update({
    where: { id: context.agencyId },
    data: { goal: input.goal },
  })
}

export const deleteAgency = async (rawAgencyId: unknown) => {
  const agencyId = z.string().uuid().parse(rawAgencyId)
  const context = await getAgencyContext(agencyId)
  assertAgencyOwner(context)
  return db.agency.delete({ where: { id: context.agencyId } })
}

export const upsertAgency = async (rawAgency: AgencyProfileInput) => {
  const agency = agencyProfileInputSchema.parse(rawAgency)
  const providerUser = await currentUser()
  if (!providerUser) throw new AccessError('UNAUTHENTICATED')
  return db.$transaction(async (transaction) => {
    const actor = await transaction.user.findUnique({
      where: { id: providerUser.id },
      select: { agencyId: true, email: true, id: true, role: true },
    })
    if (!actor) throw new AccessError('PROVISIONING_REQUIRED')
    if (actor.role !== 'AGENCY_OWNER') throw new AccessError('FORBIDDEN')

    const existingAgency = await transaction.agency.findUnique({
      where: { id: agency.id },
      select: { id: true },
    })
    if (existingAgency) {
      if (actor.agencyId !== agency.id) throw new AccessError('FORBIDDEN')
      return transaction.agency.update({
        where: { id: agency.id },
        data: {
          address: agency.address,
          agencyLogo: agency.agencyLogo,
          city: agency.city,
          companyEmail: actor.email,
          companyPhone: agency.companyPhone,
          country: agency.country,
          name: agency.name,
          state: agency.state,
          whiteLabel: agency.whiteLabel,
          zipCode: agency.zipCode,
        },
      })
    }
    if (actor.agencyId) throw new AccessError('FORBIDDEN')

    const created = await transaction.agency.create({
      data: {
        address: agency.address,
        agencyLogo: agency.agencyLogo,
        city: agency.city,
        companyEmail: actor.email,
        companyPhone: agency.companyPhone,
        connectAccountId: '',
        country: agency.country,
        customerId: '',
        id: agency.id,
        name: agency.name,
        state: agency.state,
        whiteLabel: agency.whiteLabel,
        zipCode: agency.zipCode,
        SidebarOption: {
          create: [
            {
              name: 'Dashboard',
              icon: 'category',
              link: `/agency/${agency.id}`,
            },
            {
              name: 'Launchpad',
              icon: 'clipboardIcon',
              link: `/agency/${agency.id}/launchpad`,
            },
            {
              name: 'Billing',
              icon: 'payment',
              link: `/agency/${agency.id}/billing`,
            },
            {
              name: 'Settings',
              icon: 'settings',
              link: `/agency/${agency.id}/settings`,
            },
            {
              name: 'Sub Accounts',
              icon: 'person',
              link: `/agency/${agency.id}/all-subaccounts`,
            },
            {
              name: 'Team',
              icon: 'shield',
              link: `/agency/${agency.id}/team`,
            },
          ],
        },
      },
    })
    const claim = await transaction.user.updateMany({
      where: {
        agencyId: null,
        id: actor.id,
        role: 'AGENCY_OWNER',
      },
      data: { agencyId: created.id },
    })
    if (claim.count !== 1) throw new AccessError('CONFLICT')
    return created
  })
}

export const upsertSubAccount = async (rawInput: SubaccountProfileInput) => {
  const subAccount = subaccountProfileInputSchema.parse(rawInput)
  const context = await getAgencyContext(subAccount.agencyId)
  assertAgencyOperator(context)
  const existing = await db.subAccount.findUnique({
    where: { id: subAccount.id },
    select: { agencyId: true, id: true },
  })
  if (existing && existing.agencyId !== context.agencyId) {
    throw new AccessError('FORBIDDEN')
  }

  const profile = {
    address: subAccount.address,
    city: subAccount.city,
    companyEmail: subAccount.companyEmail,
    companyPhone: subAccount.companyPhone,
    country: subAccount.country,
    name: subAccount.name,
    state: subAccount.state,
    subAccountLogo: subAccount.subAccountLogo,
    zipCode: subAccount.zipCode,
  }
  if (existing) {
    return db.subAccount.update({
      where: { id: existing.id, agencyId: context.agencyId },
      data: profile,
    })
  }

  const agencyOwner = await db.user.findFirst({
    where: {
      agencyId: context.agencyId,
      role: 'AGENCY_OWNER',
    },
  })
  if (!agencyOwner) throw new AccessError('CONFLICT')
  const permissionId = v4()
  return db.subAccount.create({
    data: {
      ...profile,
      agencyId: context.agencyId,
      connectAccountId: '',
      goal: 5000,
      id: subAccount.id,
      Permissions: {
        create: {
          access: true,
          email: agencyOwner.email,
          id: permissionId,
        },
      },
      Pipeline: {
        create: { name: 'Lead Cycle' },
      },
      SidebarOption: {
        create: [
          {
            name: 'Launchpad',
            icon: 'clipboardIcon',
            link: `/subaccount/${subAccount.id}/launchpad`,
          },
          {
            name: 'Settings',
            icon: 'settings',
            link: `/subaccount/${subAccount.id}/settings`,
          },
          {
            name: 'Funnels',
            icon: 'pipelines',
            link: `/subaccount/${subAccount.id}/funnels`,
          },
          {
            name: 'Media',
            icon: 'database',
            link: `/subaccount/${subAccount.id}/media`,
          },
          {
            name: 'Automations',
            icon: 'chip',
            link: `/subaccount/${subAccount.id}/automations`,
          },
          {
            name: 'Pipelines',
            icon: 'flag',
            link: `/subaccount/${subAccount.id}/pipelines`,
          },
          {
            name: 'Contacts',
            icon: 'person',
            link: `/subaccount/${subAccount.id}/contacts`,
          },
          {
            name: 'Dashboard',
            icon: 'category',
            link: `/subaccount/${subAccount.id}`,
          },
        ],
      },
    },
  })
}

export const deleteSubAccount = async (rawSubaccountId: unknown) => {
  const subaccountId = z.string().uuid().parse(rawSubaccountId)
  const context = await getTenantContext(subaccountId)
  assertTenantAction(context, 'subaccount:manage')
  return db.subAccount.delete({
    where: { id: context.subaccountId },
    select: {
      agencyId: true,
      id: true,
      name: true,
    },
  })
}

export const getMedia = async (subaccountId: string) => {
  const mediafiles = await db.subAccount.findUnique({
    where: {
      id: subaccountId,
    },
    include: { Media: true },
  })
  return mediafiles
}

export const createMedia = async (
  subaccountId: string,
  mediaFile: CreateMediaType
) => {
  const response = await db.media.create({
    data: {
      link: mediaFile.link,
      name: mediaFile.name,
      subAccountId: subaccountId,
    },
  })

  return response
}

export const deleteMedia = async (mediaId: string) => {
  const response = await db.media.delete({
    where: {
      id: mediaId,
    },
  })
  return response
}

export const getPipelineDetails = async (pipelineId: string) => {
  const response = await db.pipeline.findUnique({
    where: {
      id: pipelineId,
    },
  })
  return response
}

export const getLanesWithTicketAndTags = async (pipelineId: string) => {
  const response = await db.lane.findMany({
    where: {
      pipelineId,
    },
    orderBy: { order: 'asc' },
    include: {
      Tickets: {
        orderBy: {
          order: 'asc',
        },
        include: {
          Tags: true,
          Assigned: true,
          Customer: true,
        },
      },
    },
  })
  return response
}

export const upsertFunnel = async (
  rawInput: unknown
) => {
  const input = z
    .object({
      funnel: CreateFunnelFormSchema.strict(),
      funnelId: z.string().uuid(),
      subaccountId: z.string().uuid(),
    })
    .strict()
    .parse(rawInput)
  const context = await getTenantContext(input.subaccountId)
  assertTenantAction(context, 'commerce:configure')
  const existing = await db.funnel.findUnique({
    where: { id: input.funnelId },
    select: { id: true, subAccountId: true },
  })
  if (existing && existing.subAccountId !== context.subaccountId) {
    throw new AccessError('FORBIDDEN')
  }
  if (existing) {
    return db.funnel.update({
      where: { id: existing.id, subAccountId: context.subaccountId },
      data: input.funnel,
    })
  }
  return db.funnel.create({
    data: {
      ...input.funnel,
      id: input.funnelId,
      liveProducts: '[]',
      subAccountId: context.subaccountId,
    },
  })
}

export const upsertPipeline = async (
  pipeline: Prisma.PipelineUncheckedCreateWithoutLaneInput
) => {
  const response = await db.pipeline.upsert({
    where: { id: pipeline.id || v4() },
    update: pipeline,
    create: pipeline,
  })

  return response
}

export const deletePipeline = async (pipelineId: string) => {
  const response = await db.pipeline.delete({
    where: { id: pipelineId },
  })
  return response
}

export const updateLanesOrder = async (lanes: Lane[]) => {
  try {
    const updateTrans = lanes.map((lane) =>
      db.lane.update({
        where: {
          id: lane.id,
        },
        data: {
          order: lane.order,
        },
      })
    )

    await db.$transaction(updateTrans)
    console.log('🟢 Done reordered 🟢')
  } catch (error) {
    console.log(error, 'ERROR UPDATE LANES ORDER')
  }
}

export const updateTicketsOrder = async (tickets: Ticket[]) => {
  try {
    const updateTrans = tickets.map((ticket) =>
      db.ticket.update({
        where: {
          id: ticket.id,
        },
        data: {
          order: ticket.order,
          laneId: ticket.laneId,
        },
      })
    )

    await db.$transaction(updateTrans)
    console.log('🟢 Done reordered 🟢')
  } catch (error) {
    console.log(error, '🔴 ERROR UPDATE TICKET ORDER')
  }
}

export const upsertLane = async (lane: Prisma.LaneUncheckedCreateInput) => {
  let order: number

  if (!lane.order) {
    const lanes = await db.lane.findMany({
      where: {
        pipelineId: lane.pipelineId,
      },
    })

    order = lanes.length
  } else {
    order = lane.order
  }

  const response = await db.lane.upsert({
    where: { id: lane.id || v4() },
    update: lane,
    create: { ...lane, order },
  })

  return response
}

export const deleteLane = async (laneId: string) => {
  const resposne = await db.lane.delete({ where: { id: laneId } })
  return resposne
}

export const getTicketsWithTags = async (pipelineId: string) => {
  const response = await db.ticket.findMany({
    where: {
      Lane: {
        pipelineId,
      },
    },
    include: { Tags: true, Assigned: true, Customer: true },
  })
  return response
}

export const _getTicketsWithAllRelations = async (laneId: string) => {
  const response = await db.ticket.findMany({
    where: { laneId: laneId },
    include: {
      Assigned: true,
      Customer: true,
      Lane: true,
      Tags: true,
    },
  })
  return response
}

export const listContacts = async (subaccountId: string) =>
  contactService.list(subaccountId)

export const searchContacts = async (
  subaccountId: string,
  searchTerms?: string | null
) => contactService.search(subaccountId, searchTerms)

export const upsertTicket = async (
  ticket: Prisma.TicketUncheckedCreateInput,
  tags: Tag[]
) => {
  let order: number
  if (!ticket.order) {
    const tickets = await db.ticket.findMany({
      where: { laneId: ticket.laneId },
    })
    order = tickets.length
  } else {
    order = ticket.order
  }

  const response = await db.ticket.upsert({
    where: {
      id: ticket.id || v4(),
    },
    update: { ...ticket, Tags: { set: tags } },
    create: { ...ticket, Tags: { connect: tags }, order },
    include: {
      Assigned: true,
      Customer: true,
      Tags: true,
      Lane: true,
    },
  })

  return response
}

export const deleteTicket = async (ticketId: string) => {
  const response = await db.ticket.delete({
    where: {
      id: ticketId,
    },
  })

  return response
}

export const upsertTag = async (
  subaccountId: string,
  tag: Prisma.TagUncheckedCreateInput
) => {
  const response = await db.tag.upsert({
    where: { id: tag.id || v4(), subAccountId: subaccountId },
    update: tag,
    create: { ...tag, subAccountId: subaccountId },
  })

  return response
}

export const getTagsForSubaccount = async (subaccountId: string) => {
  const response = await db.subAccount.findUnique({
    where: { id: subaccountId },
    select: { Tags: true },
  })
  return response
}

export const deleteTag = async (tagId: string) => {
  const response = await db.tag.delete({ where: { id: tagId } })
  return response
}

export const createContact = async (contact: CreateContactInput) =>
  contactService.create(contact)

export const updateContact = async (contact: UpdateContactInput) =>
  contactService.update(contact)

export const submitPublicLead = async (lead: PublicLeadInput) =>
  publicLeadService.submit(lead)

export const getFunnels = async (subacountId: string) => {
  const funnels = await db.funnel.findMany({
    where: { subAccountId: subacountId },
    include: { FunnelPages: true },
  })

  return funnels
}

export const getFunnel = async (funnelId: string) => {
  const funnel = await db.funnel.findUnique({
    where: { id: funnelId },
    include: {
      FunnelPages: {
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  return funnel
}

export const upsertFunnelPage = async (
  subaccountId: string,
  funnelPage: UpsertFunnelPage,
  funnelId: string
) => {
  if (!subaccountId || !funnelId) return
  const response = await db.funnelPage.upsert({
    where: { id: funnelPage.id || '' },
    update: { ...funnelPage },
    create: {
      ...funnelPage,
      content: funnelPage.content
        ? funnelPage.content
        : JSON.stringify([
            {
              content: [],
              id: '__body',
              name: 'Body',
              styles: { backgroundColor: 'white' },
              type: '__body',
            },
          ]),
      funnelId,
    },
  })

  revalidatePath(`/subaccount/${subaccountId}/funnels/${funnelId}`, 'page')
  return response
}

export const deleteFunnelePage = async (funnelPageId: string) => {
  const response = await db.funnelPage.delete({ where: { id: funnelPageId } })

  return response
}

export const getFunnelPageDetails = async (funnelPageId: string) => {
  const response = await db.funnelPage.findUnique({
    where: {
      id: funnelPageId,
    },
  })

  return response
}

export const getDomainContent = async (subDomainName: string) => {
  const response = await db.funnel.findUnique({
    where: {
      subDomainName,
    },
    include: { FunnelPages: true },
  })
  return response
}

export const getPipelines = async (subaccountId: string) => {
  const response = await db.pipeline.findMany({
    where: { subAccountId: subaccountId },
    include: {
      Lane: {
        include: { Tickets: true },
      },
    },
  })
  return response
}
