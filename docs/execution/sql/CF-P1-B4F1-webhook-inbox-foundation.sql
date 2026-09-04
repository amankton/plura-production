-- CF-P1-B4F1 disposable-development compatibility draft only.
-- This additive DDL is intentionally outside prisma/migrations and is not
-- approved for staging, production, or any representative Crewframe database.

CREATE TABLE IF NOT EXISTS `StripeWebhookReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `mode` ENUM('TEST', 'LIVE') NOT NULL,
  `accountScopeKey` VARCHAR(255) NOT NULL,
  `eventId` VARCHAR(255) NOT NULL,
  `eventType` VARCHAR(255) NOT NULL,
  `providerCreatedAt` DATETIME(3) NOT NULL,
  `objectId` VARCHAR(255) NULL,
  `subscriptionId` VARCHAR(255) NULL,
  `customerId` VARCHAR(255) NULL,
  `payloadHash` CHAR(64) NOT NULL,
  `status` ENUM('RECEIVED', 'PROCESSING', 'RETRY_PENDING', 'SUCCEEDED', 'IGNORED', 'DEAD_LETTER') NOT NULL DEFAULT 'RECEIVED',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `leaseToken` VARCHAR(64) NULL,
  `leaseExpiresAt` DATETIME(3) NULL,
  `nextRetryAt` DATETIME(3) NULL,
  `lastErrorCode` VARCHAR(64) NULL,
  `lastErrorMessage` VARCHAR(240) NULL,
  `retentionExpiresAt` DATETIME(3) NOT NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `stripe_webhook_identity` (`mode`, `accountScopeKey`, `eventId`),
  INDEX `StripeWebhookReceipt_status_nextRetryAt_idx` (`status`, `nextRetryAt`),
  INDEX `StripeWebhookReceipt_leaseExpiresAt_idx` (`leaseExpiresAt`),
  INDEX `StripeWebhookReceipt_subscriptionId_idx` (`subscriptionId`),
  INDEX `StripeWebhookReceipt_retentionExpiresAt_idx` (`retentionExpiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StripeWebhookObjectLease` (
  `id` VARCHAR(191) NOT NULL,
  `mode` ENUM('TEST', 'LIVE') NOT NULL,
  `accountScopeKey` VARCHAR(255) NOT NULL,
  `objectType` VARCHAR(64) NOT NULL,
  `objectId` VARCHAR(255) NOT NULL,
  `leaseToken` VARCHAR(64) NOT NULL,
  `leaseExpiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `stripe_webhook_object_identity` (`mode`, `accountScopeKey`, `objectType`, `objectId`),
  INDEX `StripeWebhookObjectLease_leaseExpiresAt_idx` (`leaseExpiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StripeWebhookReplayAudit` (
  `id` VARCHAR(191) NOT NULL,
  `receiptId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(240) NOT NULL,
  `dryRun` BOOLEAN NOT NULL DEFAULT true,
  `outcome` ENUM('REQUESTED', 'DRY_RUN_READY', 'ENQUEUED', 'REJECTED', 'FAILED') NOT NULL DEFAULT 'REQUESTED',
  `safeErrorCode` VARCHAR(64) NULL,
  `safeErrorMessage` VARCHAR(240) NULL,
  `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  INDEX `StripeWebhookReplayAudit_receiptId_requestedAt_idx` (`receiptId`, `requestedAt`),
  INDEX `StripeWebhookReplayAudit_actorId_requestedAt_idx` (`actorId`, `requestedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
