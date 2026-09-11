-- CreateTable
CREATE TABLE `ClientNotification` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `body` TEXT NOT NULL,
    `path` VARCHAR(120) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `readAt` DATETIME(3) NULL,

    INDEX `ClientNotification_clientId_createdAt_idx`(`clientId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ClientNotification` ADD CONSTRAINT `ClientNotification_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
