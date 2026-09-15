-- An admin whose access the owner took away keeps their row, because the
-- questionnaires they uploaded and the changes they decided point at it.
-- The stamp is what tells "access removed" from "link not used yet".
ALTER TABLE `AdminUser` ADD COLUMN `accessRemovedAt` DATETIME(3) NULL;
