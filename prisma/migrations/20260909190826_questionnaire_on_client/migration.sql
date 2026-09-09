-- The link and the questionnaire move from the project to the client
-- (ADR 0015, QUESTIONS.md Q12). Prisma's generated diff drops projectId and
-- adds clientId NOT NULL in one step, which throws away the relationship on
-- every existing row. This one adds, backfills from each row's project, and
-- only then drops, so nothing is orphaned.

-- 1. Client gains its columns, nullable for now so they can be filled.
ALTER TABLE `Client`
  ADD COLUMN `accessTokenHash` VARCHAR(191) NULL,
  ADD COLUMN `tokenCreatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `tokenRotatedAt` DATETIME(3) NULL,
  ADD COLUMN `linkEmailedAt` DATETIME(3) NULL,
  ADD COLUMN `linkEmailError` VARCHAR(300) NULL,
  ADD COLUMN `proposedSignoffName` VARCHAR(191) NULL,
  ADD COLUMN `proposedSignoffEmail` VARCHAR(191) NULL,
  ADD COLUMN `proposedAt` DATETIME(3) NULL;

-- 2. Each client takes the link of its earliest project. A client with two
--    projects keeps one link, which is the point of the change; the other
--    project's old link stops working, and no real client has two yet.
UPDATE `Client` c
JOIN (
  SELECT p.* FROM `Project` p
  JOIN (SELECT clientId, MIN(createdAt) AS firstAt FROM `Project` GROUP BY clientId) f
    ON f.clientId = p.clientId AND f.firstAt = p.createdAt
) first ON first.clientId = c.id
SET c.accessTokenHash = first.accessTokenHash,
    c.tokenCreatedAt = first.tokenCreatedAt,
    c.tokenRotatedAt = first.tokenRotatedAt,
    c.linkEmailedAt = first.linkEmailedAt,
    c.linkEmailError = first.linkEmailError,
    c.proposedSignoffName = first.proposedSignoffName,
    c.proposedSignoffEmail = first.proposedSignoffEmail,
    c.proposedAt = first.proposedAt;

-- 3. A client that never had a project gets a hash nobody holds the other half
--    of. Their link exists the moment an admin rotates it, which the client
--    page offers; until then the row simply satisfies the constraint.
UPDATE `Client` SET `accessTokenHash` = SHA2(CONCAT(id, UUID()), 256) WHERE `accessTokenHash` IS NULL;
ALTER TABLE `Client` MODIFY `accessTokenHash` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `Client_accessTokenHash_key` ON `Client`(`accessTokenHash`);

-- 4. Sessions follow their project's client.
ALTER TABLE `ClientSession` ADD COLUMN `clientId` VARCHAR(191) NULL;
UPDATE `ClientSession` s JOIN `Project` p ON p.id = s.projectId SET s.clientId = p.clientId;
DELETE FROM `ClientSession` WHERE `clientId` IS NULL;
ALTER TABLE `ClientSession` DROP FOREIGN KEY `ClientSession_projectId_fkey`;
DROP INDEX `ClientSession_projectId_idx` ON `ClientSession`;
ALTER TABLE `ClientSession` DROP COLUMN `projectId`, MODIFY `clientId` VARCHAR(191) NOT NULL;
CREATE INDEX `ClientSession_clientId_idx` ON `ClientSession`(`clientId`);
ALTER TABLE `ClientSession` ADD CONSTRAINT `ClientSession_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. The questionnaire follows its project's client. One per client from now
--    on: where a client had two, the earlier upload is kept and the later one
--    goes, which only test data ever had.
ALTER TABLE `Intake` ADD COLUMN `clientId` VARCHAR(191) NULL;
UPDATE `Intake` i JOIN `Project` p ON p.id = i.projectId SET i.clientId = p.clientId;
DELETE i FROM `Intake` i
JOIN (
  SELECT clientId, MIN(documentUploadedAt) AS keepAt FROM `Intake` GROUP BY clientId
) k ON k.clientId = i.clientId AND i.documentUploadedAt > k.keepAt;
DELETE FROM `Intake` WHERE `clientId` IS NULL;
ALTER TABLE `Intake` DROP FOREIGN KEY `Intake_projectId_fkey`;
DROP INDEX `Intake_projectId_key` ON `Intake`;
ALTER TABLE `Intake` DROP COLUMN `projectId`, MODIFY `clientId` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `Intake_clientId_key` ON `Intake`(`clientId`);
ALTER TABLE `Intake` ADD CONSTRAINT `Intake_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Uploaded files likewise.
ALTER TABLE `IntakeFile` ADD COLUMN `clientId` VARCHAR(191) NULL;
UPDATE `IntakeFile` f JOIN `Project` p ON p.id = f.projectId SET f.clientId = p.clientId;
DELETE FROM `IntakeFile` WHERE `clientId` IS NULL;
ALTER TABLE `IntakeFile` DROP FOREIGN KEY `IntakeFile_projectId_fkey`;
DROP INDEX `IntakeFile_projectId_questionKey_idx` ON `IntakeFile`;
ALTER TABLE `IntakeFile` DROP COLUMN `projectId`, MODIFY `clientId` VARCHAR(191) NOT NULL;
CREATE INDEX `IntakeFile_clientId_questionKey_idx` ON `IntakeFile`(`clientId`, `questionKey`);
ALTER TABLE `IntakeFile` ADD CONSTRAINT `IntakeFile_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Codes belong to the client; the two sign-off purposes also keep their
--    project, because a sign-off is on a piece of work. A login code's project
--    is cleared, since a client can be signed in before any project exists.
ALTER TABLE `OneTimeCode` ADD COLUMN `clientId` VARCHAR(191) NULL;
UPDATE `OneTimeCode` o JOIN `Project` p ON p.id = o.projectId SET o.clientId = p.clientId;
DELETE FROM `OneTimeCode` WHERE `clientId` IS NULL;
ALTER TABLE `OneTimeCode` DROP FOREIGN KEY `OneTimeCode_projectId_fkey`;
DROP INDEX `OneTimeCode_projectId_purpose_createdAt_idx` ON `OneTimeCode`;
ALTER TABLE `OneTimeCode` MODIFY `clientId` VARCHAR(191) NOT NULL, MODIFY `projectId` VARCHAR(191) NULL;
UPDATE `OneTimeCode` SET `projectId` = NULL WHERE `purpose` = 'LOGIN';
CREATE INDEX `OneTimeCode_clientId_purpose_createdAt_idx` ON `OneTimeCode`(`clientId`, `purpose`, `createdAt`);
CREATE INDEX `OneTimeCode_projectId_idx` ON `OneTimeCode`(`projectId`);
ALTER TABLE `OneTimeCode` ADD CONSTRAINT `OneTimeCode_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `OneTimeCode` ADD CONSTRAINT `OneTimeCode_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 8. Only now does the project let go.
DROP INDEX `Project_accessTokenHash_key` ON `Project`;
ALTER TABLE `Project`
  DROP COLUMN `accessTokenHash`,
  DROP COLUMN `tokenCreatedAt`,
  DROP COLUMN `tokenRotatedAt`,
  DROP COLUMN `linkEmailedAt`,
  DROP COLUMN `linkEmailError`,
  DROP COLUMN `proposedSignoffName`,
  DROP COLUMN `proposedSignoffEmail`,
  DROP COLUMN `proposedAt`;
