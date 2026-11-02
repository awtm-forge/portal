-- The team's shared Today list (2 Nov 2026). Not evidence: items are ticked
-- and removed freely. The client link clears itself when the client goes.
CREATE TABLE `Todo` (
  `id` VARCHAR(191) NOT NULL,
  `text` VARCHAR(300) NOT NULL,
  `day` DATE NOT NULL,
  `doneAt` DATETIME(3) NULL,
  `clientId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Todo_day_idx`(`day`),
  INDEX `Todo_clientId_idx`(`clientId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Todo` ADD CONSTRAINT `Todo_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
