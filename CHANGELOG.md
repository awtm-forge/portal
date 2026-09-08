# Changelog

One line per step of PORTAL-SPEC §9, dated when the step was reported done. Detail lives in `BUILD-LOG.md`.

- 2026-09-05 Step 1, scaffold, shared tokens and the marketing site ported into static routes.
- 2026-09-05 Step 2, schema and migrations for the front half, partial: the journey and money tables arrive in the steps that use them.
- 2026-09-05 Step 3, client login by link and one-time code, admin auth, projects list.
- 2026-09-05 Step 4, the questionnaire in full: importer, renderer, uploads, image library, answers view.
- 2026-09-07 Step 1 completed to the new brief: the one-agreement "How we work" copy, empty case study slots hidden, Docker Compose, and the build tracking documents.
- 2026-09-07 Step 5, the agreement: money and dates, the phase machine, activity events, audience serializers, invoice numbering, the admin editor with the internal block, the client page with sign-off and push-back, the print route, the admin setup link, Playwright and CI.
- 2026-09-08 Client onboarding: clients as their own record, projects started from a client, the handover on its own screen, and the sign-off person moved to the project. Warmer copy on every client-facing email and screen.
- 2026-09-08 Step 6, the WhatsApp sign-off recording path, for the agreement kind: the same sign-off, the same invoice, and a record that never pretends they tapped. The delivery kind waits for the review loop in step 8.
- 2026-09-08 Step 7, weekly updates on both sides, the kickoff action, the booking button, the settings screen, and the agreement, weekly and invoice WhatsApp messages.
- 2026-09-08 Fixed a sign-off that could happen twice: the phase write is now conditional and is what stops it, closing the one-function rule at the same time (ADR 0011).
- 2026-09-08 Step 8, the review loop: mark ready, the client review page, unlimited changes-requested rounds, the code-gated delivery sign-off with its balance invoice and day-30 row, the thank-you page with the testimonial and referral, and the delivery half of the WhatsApp recording path.
- 2026-09-08 Moved `phoneDigits` out of `crypto.ts`, so a client component no longer drags `node:crypto` into the browser bundle and the webpack build Hostinger needs succeeds.
- 2026-09-08 Step 9, the money made visible: the printable invoice with its total in words and a GST block that waits for a GSTIN, mark paid with the date rules, and the one invoice an admin may raise by hand.
