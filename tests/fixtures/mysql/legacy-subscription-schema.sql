CREATE TABLE `Agency` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL DEFAULT '',
  `name` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Subscription` (
  `id` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT false,
  `priceId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `currentPeriodEndDate` DATETIME(3) NOT NULL,
  `subscritiptionId` VARCHAR(191) NOT NULL,
  `agencyId` VARCHAR(191) NULL,
  UNIQUE INDEX `Subscription_subscritiptionId_key` (`subscritiptionId`),
  UNIQUE INDEX `Subscription_agencyId_key` (`agencyId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Agency` (`id`, `customerId`, `name`)
VALUES ('agency_legacy', 'cus_legacy', 'Synthetic Legacy Agency');

INSERT INTO `Subscription` (
  `id`,
  `active`,
  `priceId`,
  `customerId`,
  `currentPeriodEndDate`,
  `subscritiptionId`,
  `agencyId`
) VALUES (
  'subscription_legacy',
  true,
  'price_legacy',
  'cus_legacy',
  '2030-01-01 00:00:00.000',
  'sub_legacy',
  'agency_legacy'
);
