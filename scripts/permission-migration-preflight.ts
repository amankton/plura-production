import { db } from '../src/lib/db'
import { analyzePermissionMigration } from '../src/features/team/permission-migration-preflight'

const run = async () => {
  const [users, subaccounts, permissions] = await Promise.all([
    db.user.findMany({ select: { agencyId: true, email: true, id: true } }),
    db.subAccount.findMany({ select: { agencyId: true, id: true } }),
    db.permissions.findMany({
      select: { access: true, email: true, id: true, subAccountId: true },
    }),
  ])

  const report = analyzePermissionMigration({
    permissions: permissions.map((permission) => ({
      ...permission,
      subaccountId: permission.subAccountId,
    })),
    subaccounts,
    users,
  })

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  process.stderr.write(
    'Provider mapping check: not evaluated; supply an authorized mapping during staging validation.\n'
  )
}

run()
  .catch(() => {
    process.stderr.write('Permission preflight failed; no data was changed.\n')
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
