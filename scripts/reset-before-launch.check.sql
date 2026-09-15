-- What "Starting clean before the first real client" in DEPLOY.md would erase.
-- Read only. Run this first, read the numbers, and only then run the wipe.
SELECT 'clients' AS what, COUNT(*) AS rows_ FROM Client
UNION ALL SELECT 'projects', COUNT(*) FROM Project
UNION ALL SELECT 'sign-offs', COUNT(*) FROM SignoffEvent
UNION ALL SELECT 'invoices', COUNT(*) FROM Invoice
UNION ALL SELECT 'review rounds', COUNT(*) FROM ReviewRound
UNION ALL SELECT 'testimonials', COUNT(*) FROM Testimonial
UNION ALL SELECT 'referrals', COUNT(*) FROM Referral
UNION ALL SELECT 'activity events', COUNT(*) FROM ActivityEvent
UNION ALL SELECT 'enquiries', COUNT(*) FROM Enquiry
UNION ALL SELECT 'kept: admins', COUNT(*) FROM AdminUser
UNION ALL SELECT 'kept: image library', COUNT(*) FROM ImageLibrary;

-- The highest invoice number issued so far, per financial year. After the
-- wipe the next one is 0001 again, which is only right if every one of these
-- was a test.
SELECT prefix, fy, lastSeq AS last_number_issued FROM InvoiceSequence;
