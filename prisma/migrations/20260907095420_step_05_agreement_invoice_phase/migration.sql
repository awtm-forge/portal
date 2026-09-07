/*
  Warnings:

  - You are about to drop the `LoginCode` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `LoginCode` DROP FOREIGN KEY `LoginCode_projectId_fkey`;

-- AlterTable
ALTER TABLE `Intake` ADD COLUMN `overriddenAt` DATETIME(3) NULL,
    ADD COLUMN `overriddenById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Project` ADD COLUMN `afterDelivery` ENUM('RETAINER', 'HANDOVER', 'UNDECIDED') NOT NULL DEFAULT 'UNDECIDED',
    ADD COLUMN `cancelReason` VARCHAR(500) NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `deliveredAt` DATETIME(3) NULL,
    ADD COLUMN `handoverDocUrl` VARCHAR(191) NULL,
    ADD COLUMN `linkEmailError` VARCHAR(300) NULL,
    ADD COLUMN `linkEmailedAt` DATETIME(3) NULL,
    ADD COLUMN `metricBaselineCapturedAt` DATETIME(3) NULL,
    ADD COLUMN `metricBaselineValue` VARCHAR(191) NULL,
    ADD COLUMN `metricName` VARCHAR(191) NULL,
    ADD COLUMN `phase` ENUM('INTAKE', 'AGREEMENT_DRAFT', 'AGREEMENT_SENT', 'AGREED', 'BUILDING', 'IN_REVIEW', 'DELIVERED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'INTAKE',
    ADD COLUMN `retainerNamedPerson` VARCHAR(191) NULL,
    ADD COLUMN `retainerResponseTime` VARCHAR(191) NULL,
    ADD COLUMN `retainerTier` VARCHAR(191) NULL,
    ADD COLUMN `weekCount` INTEGER NULL;

-- DropTable
DROP TABLE `LoginCode`;

-- CreateTable
CREATE TABLE `OneTimeCode` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `purpose` ENUM('LOGIN', 'AGREEMENT', 'DELIVERY') NOT NULL DEFAULT 'LOGIN',
    `codeHash` VARCHAR(191) NOT NULL,
    `sentTo` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `consumedAt` DATETIME(3) NULL,

    INDEX `OneTimeCode_projectId_purpose_createdAt_idx`(`projectId`, `purpose`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Company` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'company',
    `name` VARCHAR(191) NOT NULL,
    `address` TEXT NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `logoUrl` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `bankAccountName` VARCHAR(191) NULL,
    `bankAccountNumber` VARCHAR(191) NULL,
    `bankIfsc` VARCHAR(191) NULL,
    `upiId` VARCHAR(191) NULL,
    `invoicePrefix` VARCHAR(191) NOT NULL DEFAULT 'AWTM',
    `gstin` VARCHAR(191) NULL,
    `bookingUrl` VARCHAR(191) NULL,
    `defaultAdvancePct` INTEGER NOT NULL DEFAULT 50,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `type` VARCHAR(16) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Agreement` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `scope` TEXT NOT NULL,
    `deliverables` JSON NOT NULL,
    `notIncluded` TEXT NOT NULL,
    `startDate` DATETIME(3) NULL,
    `launchTargetDate` DATETIME(3) NULL,
    `milestones` JSON NOT NULL,
    `totalPaise` BIGINT NOT NULL DEFAULT 0,
    `advancePct` INTEGER NOT NULL,
    `howWeWork` TEXT NOT NULL,
    `ifWeMiss` TEXT NOT NULL,
    `afterDeliveryOffer` TEXT NOT NULL,
    `internalCostPaise` BIGINT NOT NULL DEFAULT 0,
    `internalNotes` TEXT NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `agreedAt` DATETIME(3) NULL,
    `agreedByName` VARCHAR(191) NULL,
    `agreedMethod` ENUM('PORTAL', 'WHATSAPP') NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Agreement_projectId_key`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgreementNote` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `agreementVersion` INTEGER NOT NULL,
    `text` TEXT NOT NULL,
    `enteredBy` VARCHAR(16) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgreementNote_projectId_createdAt_idx`(`projectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SignoffEvent` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `kind` ENUM('AGREEMENT', 'DELIVERY') NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `method` ENUM('PORTAL', 'WHATSAPP') NOT NULL,
    `actorName` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(400) NULL,
    `rawNote` TEXT NULL,
    `agreementVersion` INTEGER NULL,

    INDEX `SignoffEvent_projectId_kind_idx`(`projectId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `kind` ENUM('ADVANCE', 'BALANCE', 'OTHER') NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `description` VARCHAR(300) NOT NULL,
    `amountPaise` BIGINT NOT NULL,
    `taxAmountPaise` BIGINT NOT NULL DEFAULT 0,
    `totalPaise` BIGINT NOT NULL,
    `status` ENUM('ISSUED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'ISSUED',
    `paidAt` DATETIME(3) NULL,
    `paidReference` VARCHAR(191) NULL,
    `paymentMethod` VARCHAR(191) NULL,

    UNIQUE INDEX `Invoice_number_key`(`number`),
    INDEX `Invoice_projectId_kind_idx`(`projectId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceSequence` (
    `prefix` VARCHAR(16) NOT NULL,
    `fy` VARCHAR(8) NOT NULL,
    `lastSeq` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`prefix`, `fy`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityEvent` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `type` VARCHAR(64) NOT NULL,
    `payload` JSON NOT NULL,
    `actor` VARCHAR(120) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityEvent_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `ActivityEvent_type_createdAt_idx`(`type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OneTimeCode` ADD CONSTRAINT `OneTimeCode_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Agreement` ADD CONSTRAINT `Agreement_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgreementNote` ADD CONSTRAINT `AgreementNote_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SignoffEvent` ADD CONSTRAINT `SignoffEvent_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityEvent` ADD CONSTRAINT `ActivityEvent_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
