'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Role, type User } from '@prisma/client'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  changeMemberRole,
  grantMemberPermission,
  revokeMemberPermission,
  updateMyProfile,
} from '@/features/team/actions'
import type {
  TeamMemberRecord,
  TeamPermissionRecord,
} from '@/features/team/team-service'
import { useModal } from '@/providers/modal-provider'
import FileUpload from '../global/file-upload'
import Loading from '../global/loading'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form'
import { Input } from '../ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Separator } from '../ui/separator'
import { Switch } from '../ui/switch'
import { useToast } from '../ui/use-toast'

type EditableProfile = Pick<
  User,
  'avatarUrl' | 'email' | 'id' | 'name' | 'role'
>

type Props = {
  subAccounts?: readonly { id: string; name: string }[]
  targetUser?: TeamMemberRecord
  userData?: EditableProfile
}

const profileSchema = z.object({
  avatarUrl: z.string().trim().url().max(2048),
  name: z.string().trim().min(1).max(120),
})

const managedRoles = [
  Role.AGENCY_ADMIN,
  Role.SUBACCOUNT_USER,
  Role.SUBACCOUNT_GUEST,
] as const

const UserDetails = ({ subAccounts = [], targetUser, userData }: Props) => {
  const selectedUser = targetUser ?? userData
  const editingTeamMember = Boolean(targetUser)
  const [role, setRole] = useState<Role>(
    selectedUser?.role ?? Role.SUBACCOUNT_USER
  )
  const [permissions, setPermissions] = useState<
    readonly TeamPermissionRecord[]
  >(targetUser?.permissions ?? [])
  const [loadingPermissionId, setLoadingPermissionId] = useState<string | null>(
    null
  )
  const { setClose } = useModal()
  const { toast } = useToast()
  const router = useRouter()
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: {
      avatarUrl: selectedUser?.avatarUrl ?? '',
      name: selectedUser?.name ?? '',
    },
  })

  useEffect(() => {
    form.reset({
      avatarUrl: selectedUser?.avatarUrl ?? '',
      name: selectedUser?.name ?? '',
    })
    setRole(selectedUser?.role ?? Role.SUBACCOUNT_USER)
    setPermissions(targetUser?.permissions ?? [])
  }, [form, selectedUser, targetUser])

  const onChangePermission = async (
    subaccountId: string,
    access: boolean
  ) => {
    if (!targetUser) return
    setLoadingPermissionId(subaccountId)
    try {
      const changePermission = access
        ? grantMemberPermission
        : revokeMemberPermission
      const updated = await changePermission({
        subaccountId,
        targetUserId: targetUser.id,
      })
      setPermissions((current) => {
        const withoutTarget = current.filter(
          (item) => item.subaccount.id !== subaccountId
        )
        return updated ? [...withoutTarget, updated] : withoutTarget
      })
      toast({ title: 'Permission updated' })
      router.refresh()
    } catch {
      toast({
        description: 'The permission could not be updated.',
        title: 'Access change failed',
        variant: 'destructive',
      })
    } finally {
      setLoadingPermissionId(null)
    }
  }

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    try {
      if (targetUser) {
        await changeMemberRole({ role, targetUserId: targetUser.id })
        toast({ title: 'Team role updated' })
      } else {
        await updateMyProfile(values)
        toast({ title: 'Profile updated' })
      }
      setClose()
      router.refresh()
    } catch {
      toast({
        description: 'The requested profile change was not applied.',
        title: 'Update failed',
        variant: 'destructive',
      })
    }
  }

  if (!selectedUser) return null

  const canHaveSubaccountPermissions =
    role === Role.SUBACCOUNT_USER || role === Role.SUBACCOUNT_GUEST

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {editingTeamMember ? 'Team Member Access' : 'Your Profile'}
        </CardTitle>
        <CardDescription>
          {editingTeamMember
            ? 'Manage this member’s role and subaccount access.'
            : 'Update your display name and profile picture.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {editingTeamMember ? (
              <div className="space-y-2">
                <FormLabel>Profile picture</FormLabel>
                <Input
                  readOnly
                  value={selectedUser.avatarUrl}
                />
              </div>
            ) : (
              <FormField
                disabled={form.formState.isSubmitting}
                control={form.control}
                name="avatarUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile picture</FormLabel>
                    <FormControl>
                      <FileUpload
                        apiEndpoint="avatar"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              disabled={form.formState.isSubmitting || editingTeamMember}
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User full name</FormLabel>
                  <FormControl>
                    <Input
                      required
                      placeholder="Full Name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Email</FormLabel>
              <Input
                readOnly
                value={selectedUser.email}
              />
            </div>

            <div className="space-y-2">
              <FormLabel>User role</FormLabel>
              {editingTeamMember && selectedUser.role !== Role.AGENCY_OWNER ? (
                <Select
                  disabled={form.formState.isSubmitting}
                  value={role}
                  onValueChange={(value) => setRole(value as Role)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user role" />
                  </SelectTrigger>
                  <SelectContent>
                    {managedRoles.map((managedRole) => (
                      <SelectItem
                        key={managedRole}
                        value={managedRole}
                      >
                        {managedRole}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  readOnly
                  value={selectedUser.role}
                />
              )}
            </div>

            {editingTeamMember && selectedUser.role !== Role.AGENCY_OWNER && (
              <Button
                disabled={form.formState.isSubmitting}
                type="submit"
              >
                {form.formState.isSubmitting ? <Loading /> : 'Save Team Role'}
              </Button>
            )}
            {!editingTeamMember && (
              <Button
                disabled={form.formState.isSubmitting}
                type="submit"
              >
                {form.formState.isSubmitting ? <Loading /> : 'Save Profile'}
              </Button>
            )}

            {editingTeamMember && canHaveSubaccountPermissions && (
              <div>
                <Separator className="my-4" />
                <FormLabel>Subaccount permissions</FormLabel>
                <FormDescription className="mb-4">
                  Grant only the subaccounts this member should access.
                </FormDescription>
                <div className="flex flex-col gap-4">
                  {subAccounts.map((subaccount) => {
                    const existing = permissions.find(
                      (item) => item.subaccount.id === subaccount.id
                    )
                    return (
                      <div
                        key={subaccount.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <p>{subaccount.name}</p>
                        <Switch
                          disabled={loadingPermissionId === subaccount.id}
                          checked={existing?.access ?? false}
                          onCheckedChange={(access) =>
                            onChangePermission(subaccount.id, access)
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default UserDetails
