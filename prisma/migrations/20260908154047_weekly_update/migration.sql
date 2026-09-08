-- AlterTable
ALTER TABLE `Client` ALTER COLUMN `updatedAt` DROP DEFAULT;
-- CreateTable
CREATE TABLE `Update` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `weekNumber` INTEGER NOT NULL,
    `moved` TEXT NOT NULL,
    `nextUp` TEXT NOT NULL,
    `needFromYou` TEXT NOT NULL,
    `needByDate` DATETIME(3) NULL,
    `risks` TEXT NOT NULL,
    `stagingUrl` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Update_projectId_sentAt_idx`(`projectId`, `sentAt`),
    UNIQUE INDEX `Update_projectId_weekNumber_key`(`projectId`, `weekNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- AddForeignKey
ALTER TABLE `Update` ADD CONSTRAINT `Update_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
