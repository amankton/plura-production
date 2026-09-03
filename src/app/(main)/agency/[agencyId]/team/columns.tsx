'use client'

import type { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import { Role } from '@prisma/client'
import Image from 'next/image'
import { Copy, Edit, MoreHorizontal, Trash } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UserDetails from '@/components/forms/user-details'
import CustomModal from '@/components/global/custom-modal'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { removeMember } from '@/features/team/actions'
import type {
  TeamMemberRecord,
  TeamSubaccountRecord,
} from '@/features/team/team-service'
import { useModal } from '@/providers/modal-provider'

export const createColumns = (
  subaccounts: readonly TeamSubaccountRecord[]
): ColumnDef<TeamMemberRecord>[] => [
  {
    accessorKey: 'id',
    header: '',
    cell: () => null,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="flex items-center gap-4">
        <div className="h-11 w-11 relative flex-none">
          <Image
            src={row.original.avatarUrl}
            fill
            className="rounded-full object-cover"
            alt="avatar image"
          />
        </div>
        <span>{row.original.name}</span>
      </div>
    ),
  },
  { accessorKey: 'email', header: 'Email' },
  {
    id: 'subaccounts',
    header: 'Subaccount Access',
    cell: ({ row }) => {
      if (row.original.role === Role.AGENCY_OWNER) {
        return <Badge className="bg-slate-600">Agency owner</Badge>
      }
      if (row.original.role === Role.AGENCY_ADMIN) {
        return <Badge className="bg-slate-600">All agency subaccounts</Badge>
      }

      const allowed = row.original.permissions.filter((item) => item.access)
      return allowed.length ? (
        <div className="flex flex-col items-start gap-2">
          {allowed.map((item) => (
            <Badge
              key={item.id}
              className="bg-slate-600 w-fit whitespace-nowrap"
            >
              {item.subaccount.name}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">No access yet</span>
      )
    },
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => (
      <Badge
        className={clsx({
          'bg-emerald-500': row.original.role === Role.AGENCY_OWNER,
          'bg-orange-400': row.original.role === Role.AGENCY_ADMIN,
          'bg-primary': row.original.role === Role.SUBACCOUNT_USER,
          'bg-muted': row.original.role === Role.SUBACCOUNT_GUEST,
        })}
      >
        {row.original.role}
      </Badge>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <CellActions
        rowData={row.original}
        subaccounts={subaccounts}
      />
    ),
  },
]

const CellActions = ({
  rowData,
  subaccounts,
}: {
  rowData: TeamMemberRecord
  subaccounts: readonly TeamSubaccountRecord[]
}) => {
  const { setOpen } = useModal()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onRemove = async () => {
    setLoading(true)
    try {
      await removeMember({ targetUserId: rowData.id })
      toast({
        description: 'The member no longer has access to this agency.',
        title: 'Team member removed',
      })
      router.refresh()
    } catch {
      toast({
        description: 'The member was not removed.',
        title: 'Removal failed',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
          >
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem
            className="flex gap-2"
            onClick={() => navigator.clipboard.writeText(rowData.email)}
          >
            <Copy size={15} /> Copy Email
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex gap-2"
            onClick={() =>
              setOpen(
                <CustomModal
                  subheading="Change role and explicit subaccount access."
                  title="Manage Team Member"
                >
                  <UserDetails
                    targetUser={rowData}
                    subAccounts={subaccounts}
                  />
                </CustomModal>
              )
            }
          >
            <Edit size={15} /> Manage Access
          </DropdownMenuItem>
          {rowData.role !== Role.AGENCY_OWNER && (
            <AlertDialogTrigger asChild>
              <DropdownMenuItem className="flex gap-2">
                <Trash size={15} /> Remove User
              </DropdownMenuItem>
            </AlertDialogTrigger>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-left">
            Remove this team member?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            Their local Crewframe access and related permissions will be
            removed. Their external identity remains intact.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            className="bg-destructive hover:bg-destructive"
            onClick={onRemove}
          >
            {loading ? 'Removing…' : 'Remove'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
