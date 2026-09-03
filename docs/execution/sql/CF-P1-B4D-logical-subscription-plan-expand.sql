-- Staging draft only. Do not apply before the subscription-plan preflight,
-- a representative backup, and establishment of the Prisma migration baseline.
ALTER TABLE `Subscription`
  ADD COLUMN `logicalPlan` ENUM('BASIC', 'UNLIMITED') NULL;
