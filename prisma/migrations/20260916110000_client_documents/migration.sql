-- Files a client hands us outside the questionnaire, and files we hand them
-- (ADR 0025, Ayush 16 Sep). Not evidence: either side can remove one.
CREATE TABLE `ClientDocument` (
  `id` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `uploadedBy` ENUM('CLIENT', 'TEAM') NOT NULL,
  `originalName` VARCHAR(300) NOT NULL,
  `mimeType` VARCHAR(191) NOT NULL,
  `sizeBytes` INTEGER NOT NULL,
  `storedPath` VARCHAR(191) NOT NULL,
  `thumbPath` VARCHAR(191) NULL,
  `note` VARCHAR(300) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ClientDocument_clientId_idx`(`clientId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ClientDocument` ADD CONSTRAINT `ClientDocument_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
