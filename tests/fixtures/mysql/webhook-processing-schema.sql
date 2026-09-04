CREATE TABLE `Agency` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL DEFAULT '',
  `name` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `Agency_customerId_idx` (`customerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Subscription` (
  `id` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `plan` ENUM(
    'price_1OYxkqFj9oKEERu1NbKUxXxN',
    'price_1OYxkqFj9oKEERu1KfJGWxgN'
  ) NULL,
  `logicalPlan` ENUM('BASIC', 'UNLIMITED') NULL,
  `price` VARCHAR(191) NULL,
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

INSERT INTO `Agency` (`id`, `customerId`, `name`) VALUES
  ('agency_a', 'cus_agency', 'Synthetic Agency A'),
  ('agency_legacy', 'cus_legacy', 'Synthetic Legacy Agency');

INSERT INTO `Subscription` (
  `id`,
  `createdAt`,
  `updatedAt`,
  `plan`,
  `logicalPlan`,
  `price`,
  `active`,
  `priceId`,
  `customerId`,
  `currentPeriodEndDate`,
  `subscritiptionId`,
  `agencyId`
) VALUES (
  'subscription_legacy',
  '2025-01-01 00:00:00.000',
  '2025-01-01 00:00:00.000',
  'price_1OYxkqFj9oKEERu1NbKUxXxN',
  NULL,
  'legacy-price-marker',
  true,
  'price_legacy',
  'cus_legacy',
  '2030-01-01 00:00:00.000',
  'sub_legacy',
  'agency_legacy'
);
