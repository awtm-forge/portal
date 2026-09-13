-- The client home page now says when to expect the next thing from us, and
-- when the project last moved. Two nullable columns rather than a table:
--
-- expectedBy is a promise we made by hand, so only admin writes it, and
-- transition() clears it on every phase move. A date set for the stage that
-- just ended is not true of the one that started. It is deliberately not
-- Agreement.launchTargetDate, which is contractual and frozen on agreeing.
--
-- lastMovedAt exists because Project has no updatedAt and the activity log
-- cannot answer the question: emit() swallows its own failure so a lost log
-- never rolls back a sign-off, it runs after the transaction commits, and
-- several client-visible events carry no projectId. A stamp the client reads
-- as fact has to be written in the same transaction as the change.
--
-- Both are null on every existing row, which is exactly right: we have not
-- told anyone a date, and no phase has moved since this shipped.
ALTER TABLE `Project` ADD COLUMN `expectedBy` DATETIME(3) NULL,
                      ADD COLUMN `lastMovedAt` DATETIME(3) NULL;
