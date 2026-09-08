-- The sign-off person moves from the client to the project. Decided by Rahul
-- on 8 Sep 2026: one business can have a different approver for a brand job
-- than for a store rebuild. This departs from PORTAL-SPEC section 4.
--
-- Additive first, copy, then drop, so no existing project loses its approver.

ALTER TABLE `Project`
  ADD COLUMN `signoffPersonName` VARCHAR(191) NULL,
  ADD COLUMN `signoffPersonEmail` VARCHAR(191) NULL,
  ADD COLUMN `proposedSignoffName` VARCHAR(191) NULL,
  ADD COLUMN `proposedSignoffEmail` VARCHAR(191) NULL,
  ADD COLUMN `proposedAt` DATETIME(3) NULL;

UPDATE `Project` p
  JOIN `Client` c ON c.id = p.clientId
  SET p.signoffPersonName = c.signoffPersonName,
      p.signoffPersonEmail = c.signoffPersonEmail,
      p.proposedSignoffName = c.proposedSignoffName,
      p.proposedSignoffEmail = c.proposedSignoffEmail,
      p.proposedAt = c.proposedAt;

-- Anything without a client row to copy from falls back to the contact.
UPDATE `Project` p
  JOIN `Client` c ON c.id = p.clientId
  SET p.signoffPersonName = COALESCE(p.signoffPersonName, c.contactName),
      p.signoffPersonEmail = COALESCE(p.signoffPersonEmail, c.contactEmail)
  WHERE p.signoffPersonName IS NULL OR p.signoffPersonEmail IS NULL;

ALTER TABLE `Project`
  MODIFY `signoffPersonName` VARCHAR(191) NOT NULL,
  MODIFY `signoffPersonEmail` VARCHAR(191) NOT NULL;

ALTER TABLE `Client`
  DROP COLUMN `signoffPersonName`,
  DROP COLUMN `signoffPersonEmail`,
  DROP COLUMN `proposedSignoffName`,
  DROP COLUMN `proposedSignoffEmail`,
  DROP COLUMN `proposedAt`,
  ADD COLUMN `location` VARCHAR(191) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
