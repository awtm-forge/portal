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
- 2026-09-09 The marketing site leaves the root and this host serves the portal only (ADR 0012), and the client portal and the team admin answer on two hostnames from one app (ADR 0013).
- 2026-09-09 Ready to deploy: /healthz, demo data kept out of production, and a runbook that matches the code rather than the staging plan it was written for.
- 2026-09-09 Step 10, day 30: the page that unlocks by arithmetic rather than a scheduled job, the number, the quote approved in the client's own hands, friction notes for us, and the last of the WhatsApp templates. Closing a project, which the spec described and nothing did.
- 2026-09-09 Step 11, the needs-attention block worked out on read, the runbook, a request id on every response, cancelling a project, and the kickoff timestamp the eight-day rule needed.
- 2026-09-09 The acceptance audit: all thirty-four criteria mapped to what covers them, five missing tests written, and five left that need a person rather than a test.
- 2026-09-09 Closed most of the audit's gaps: error logs can no longer carry a password, and every client page is checked at 375px, which found that criterion 13 asks for a button three pages should not have.
- 2026-09-09 The way-in page at / composes at any width instead of sitting in the corner of a laptop screen, and the weekly update no longer prints a full stop in the middle of a sentence.
- 2026-09-09 The client portal works on a desktop: the shell spans the window, the measure grows with it, option lists spread out, and the questionnaire lost five hundred pixels of height. The layout rules are tested at both widths now.
- 2026-09-09 A first-run page that makes the first admin account from a browser, because the host will not run a script beside the app. Found and fixed a rate limiter that threw a 500 on a double click.
- 2026-09-10 The questionnaire comes before the project: the link, the sessions and the questionnaire belong to the client, saving a client shows their link, sending the questionnaire emails it, and a project goes on the link they already have (ADR 0015).
- 2026-09-10 A quiet Back under the button on every questionnaire section after the first, because the way to an earlier section was tapping its title and nothing said so.
- 2026-09-10 The questionnaire locks when sent. A change is asked for in a line, opened or declined by the team, and sent as the next version; admin reads every version with what changed marked (ADR 0016).
- 2026-09-10 A usability pass on the client portal at Ayush's request: a quiet row of links to the pages that exist for the client, a Reach us control with WhatsApp and email on every page, a five-word where-you-are strip, an invoices page, a labelled code box that says where the code went, milestone dates written like the other dates, and the footer made into real links (Q15).
- 2026-09-10 The three manual acceptance checks done and recorded: both print routes on A4, the picture question, all eight question types at phone width. The print check found the print palette was the screen one and fixed it. The image library moved into a module, so no admin page reads its table directly.

