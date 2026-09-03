import { db } from '../src/lib/db'
import { analyzeSubscriptionPlanMigration } from '../src/lib/stripe/subscription-plan-migration-preflight'

const run = async () => {
  const subscriptions = await db.subscription.findMany({
    select: { active: true, id: true, plan: true, priceId: true },
  })
  const report = analyzeSubscriptionPlanMigration(subscriptions)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  process.stderr.write(
    'Provider lookup-key verification was not performed; no data was changed.\n'
  )
}

run()
  .catch(() => {
    process.stderr.write(
      'Subscription plan preflight failed; no data was changed.\n'
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
