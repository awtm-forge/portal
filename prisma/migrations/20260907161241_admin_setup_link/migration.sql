-- AlterTable
ALTER TABLE `AdminUser` ADD COLUMN `setupExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `setupLinkUsedAt` DATETIME(3) NULL,
    ADD COLUMN `setupTokenHash` VARCHAR(191) NULL,
    MODIFY `passwordHash` VARCHAR(191) NULL;
-- CreateIndex
CREATE UNIQUE INDEX `AdminUser_setupTokenHash_key` ON `AdminUser`(`setupTokenHash`);
