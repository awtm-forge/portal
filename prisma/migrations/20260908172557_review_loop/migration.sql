-- AlterTable
ALTER TABLE `Project` ADD COLUMN `thanksSeenAt` DATETIME(3) NULL;
-- CreateTable
CREATE TABLE `ReviewRound` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `roundNumber` INTEGER NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedWorkUrl` VARCHAR(500) NOT NULL,
    `clientNote` TEXT NULL,
    `respondedAt` DATETIME(3) NULL,
    `outcome` ENUM('OPEN', 'CHANGES_REQUESTED', 'ACCEPTED') NOT NULL DEFAULT 'OPEN',
    INDEX `ReviewRound_projectId_sentAt_idx`(`projectId`, `sentAt`),
    UNIQUE INDEX `ReviewRound_projectId_roundNumber_key`(`projectId`, `roundNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `Testimonial` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `moment` ENUM('DELIVERY', 'DAY30') NOT NULL,
    `text` TEXT NOT NULL,
    `useName` BOOLEAN NOT NULL DEFAULT false,
    `useLogo` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'APPROVED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedMethod` ENUM('PORTAL', 'WHATSAPP') NULL,
    UNIQUE INDEX `Testimonial_projectId_moment_key`(`projectId`, `moment`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `Referral` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contact` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `Referral_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `Day30` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `unlocksAt` DATETIME(3) NOT NULL,
    `openedAt` DATETIME(3) NULL,
    `metricAfterValue` VARCHAR(191) NULL,
    `metricAfterSubmittedAt` DATETIME(3) NULL,
    `frictionNotes` TEXT NOT NULL,
    UNIQUE INDEX `Day30_projectId_key`(`projectId`),
    INDEX `Day30_unlocksAt_idx`(`unlocksAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- AddForeignKey
ALTER TABLE `ReviewRound` ADD CONSTRAINT `ReviewRound_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `Testimonial` ADD CONSTRAINT `Testimonial_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `Referral` ADD CONSTRAINT `Referral_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `Day30` ADD CONSTRAINT `Day30_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
