-- CreateTable
CREATE TABLE `IntakeVersion` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `answers` JSON NOT NULL,
    `accessGranted` JSON NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentBy` ENUM('CLIENT', 'TEAM') NOT NULL,

    UNIQUE INDEX `IntakeVersion_clientId_version_key`(`clientId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IntakeChangeRequest` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `status` ENUM('ASKED', 'OPEN', 'DECLINED', 'SENT') NOT NULL DEFAULT 'ASKED',
    `note` TEXT NOT NULL,
    `askedBy` ENUM('CLIENT', 'TEAM') NOT NULL,
    `askedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decidedAt` DATETIME(3) NULL,
    `decidedById` VARCHAR(191) NULL,
    `reply` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `version` INTEGER NULL,

    INDEX `IntakeChangeRequest_clientId_status_idx`(`clientId`, `status`),
    INDEX `IntakeChangeRequest_decidedById_idx`(`decidedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `IntakeVersion` ADD CONSTRAINT `IntakeVersion_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IntakeChangeRequest` ADD CONSTRAINT `IntakeChangeRequest_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IntakeChangeRequest` ADD CONSTRAINT `IntakeChangeRequest_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Every questionnaire already sent gets its version 1, so the record starts
-- whole: what the client said when they first sent it, kept as it was.
INSERT INTO `IntakeVersion` (`id`, `clientId`, `version`, `answers`, `accessGranted`, `sentAt`, `sentBy`)
SELECT CONCAT('iv1_', `id`), `clientId`, 1, `answers`, `accessGranted`, `submittedAt`, 'CLIENT'
FROM `Intake`
WHERE `submittedAt` IS NOT NULL;
