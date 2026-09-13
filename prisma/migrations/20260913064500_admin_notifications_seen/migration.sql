-- The team's notification feed is read from the activity log, so there is no
-- new table: this only marks how far down it each admin has read. Null means
-- they have never opened the page and everything is new.
ALTER TABLE `AdminUser` ADD COLUMN `notificationsSeenAt` DATETIME(3) NULL;
