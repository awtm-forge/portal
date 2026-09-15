-- Starting clean before the first real client (DEPLOY.md, 15 Sep 2026).
--
-- This erases every client and everything that ever happened to them,
-- evidence included, and resets the invoice numbering. It exists for one
-- moment: after trying the portal out with test clients and before the first
-- real one. It must never run after that. The rule that a sign-off, an issued
-- invoice and a review round have no delete path is about real evidence; the
-- day a real client exists, this file is the wrong answer to every question.
--
-- Kept: AdminUser and AdminSession (your logins), Company and Setting (your
-- details), ImageLibrary (the logo directions), _prisma_migrations.
-- Run scripts/reset-before-launch.check.sql first and read the numbers.

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE ActivityEvent;
TRUNCATE TABLE Referral;
TRUNCATE TABLE Testimonial;
TRUNCATE TABLE Day30;
TRUNCATE TABLE ReviewRound;
TRUNCATE TABLE `Update`;
TRUNCATE TABLE Invoice;
TRUNCATE TABLE InvoiceSequence;
TRUNCATE TABLE SignoffEvent;
TRUNCATE TABLE AgreementNote;
TRUNCATE TABLE Agreement;
TRUNCATE TABLE ClientNotification;
TRUNCATE TABLE IntakeChangeRequest;
TRUNCATE TABLE IntakeVersion;
TRUNCATE TABLE IntakeFile;
TRUNCATE TABLE Intake;
TRUNCATE TABLE OneTimeCode;
TRUNCATE TABLE ClientSession;
TRUNCATE TABLE Project;
TRUNCATE TABLE Client;
TRUNCATE TABLE RateLimit;
TRUNCATE TABLE Enquiry;

SET FOREIGN_KEY_CHECKS = 1;
