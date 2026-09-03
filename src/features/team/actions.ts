'use server'

import { Role } from '@prisma/client'
import { teamService } from './server-team-service'

export async function listAgencyTeam(agencyId: string) {
  return teamService.list(agencyId)
}

export async function getMemberPermissions(input: { targetUserId: string }) {
  return teamService.getPermissions(input)
}

export async function getTeamMember(input: { targetUserId: string }) {
  return teamService.getMember(input)
}

export async function updateMyProfile(input: {
  avatarUrl: string
  name: string
}) {
  return teamService.updateMyProfile(input)
}

export async function changeMemberRole(input: {
  role: Role
  targetUserId: string
}) {
  return teamService.changeRole(input)
}

export async function grantMemberPermission(input: {
  subaccountId: string
  targetUserId: string
}) {
  return teamService.grantPermission(input)
}

export async function revokeMemberPermission(input: {
  subaccountId: string
  targetUserId: string
}) {
  return teamService.revokePermission(input)
}

export async function removeMember(input: { targetUserId: string }) {
  return teamService.removeMember(input)
}

export async function inviteMember(input: { email: string; role: Role }) {
  return teamService.invite(input)
}
