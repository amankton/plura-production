CREATE DATABASE `crewframe_p02_logical_good`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE `crewframe_p02_logical_bad`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE `crewframe_p02_webhook_good`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE `crewframe_p02_webhook_bad`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `crewframe_p02_logical_good`;

CREATE TABLE `Subscription` (
  `id` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `plan` VARCHAR(64) NULL,
  `price` VARCHAR(64) NULL,
  `active` BOOLEAN NOT NULL DEFAULT false,
  `priceId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `currentPeriodEndDate` DATETIME(3) NOT NULL,
  `subscritiptionId` VARCHAR(191) NOT NULL,
  `agencyId` VARCHAR(191) NULL,
  UNIQUE INDEX `Subscription_subscritiptionId_key` (`subscritiptionId`),
  UNIQUE INDEX `Subscription_agencyId_key` (`agencyId`),
  INDEX `Subscription_customerId_idx` (`customerId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Subscription` (
  `id`, `updatedAt`, `plan`, `price`, `active`, `priceId`, `customerId`,
  `currentPeriodEndDate`, `subscritiptionId`, `agencyId`
) VALUES
  ('record_a', '2030-01-01 00:00:00.000', 'LEGACY_BASIC', 'catalog_a', true, 'catalog_a', 'customer_a', '2030-02-01 00:00:00.000', 'subscription_a', 'agency_a'),
  ('record_b', '2030-01-01 00:00:00.000', 'LEGACY_UNLIMITED', 'catalog_b', true, 'catalog_b', 'customer_b', '2030-02-01 00:00:00.000', 'subscription_b', 'agency_b'),
  ('record_c', '2030-01-01 00:00:00.000', NULL, 'catalog_c', false, 'catalog_c', 'customer_c', '2030-02-01 00:00:00.000', 'subscription_c', 'agency_c'),
  ('record_d', '2030-01-01 00:00:00.000', 'LEGACY_UNKNOWN', 'catalog_d', false, 'catalog_d', 'customer_d', '2030-02-01 00:00:00.000', 'subscription_d', 'agency_d'),
  ('record_e', '2030-01-01 00:00:00.000', 'LEGACY_BASIC', 'catalog_e', true, 'catalog_e', 'customer_e', '2030-02-01 00:00:00.000', 'subscription_e', 'agency_e');

USE `crewframe_p02_logical_bad`;

CREATE TABLE `Subscription` (
  `id` VARCHAR(191) NOT NULL,
  `plan` VARCHAR(64) NULL,
  `price` VARCHAR(64) NULL,
  `logicalPlan` VARCHAR(32) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `crewframe_p02_webhook_bad`;

CREATE TABLE `StripeWebhookReceipt` (
  `id` BIGINT NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
