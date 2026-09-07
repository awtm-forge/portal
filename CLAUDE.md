# CLAUDE.md, awtm forge: site and client portal build

This file is read by Claude Code at the start of every session in this repo. It is the standing brief for one job: build awtmforge.com with the client portal inside it, from an empty repo to a deployed site, end to end, without waiting for Rahul between steps. Read it fully every session, then read `BUILD-LOG.md`, then continue from the first unfinished step. Do not ask Rahul anything this file already answers.

Written 7 Sep 2026. Rahul and Ayush are the two founders of awtm forge, Bengaluru. Rahul runs product, design and the client side. Ayush runs the build and holds every hosting, database and mail account.

## 1. What you are building

One Next.js codebase on one domain, three zones: the marketing site (static), the client portal (`/p/[token]/...`), and the team admin (`/admin/*`), plus two printable routes. The portal takes a client from their first login to an approved testimonial: questionnaire, one agreement with a code-gated sign-off, weekly updates and a biweekly sync, a review loop, one delivery sign-off, a thank-you page with the first testimonial ask, two invoices, a day-30 page.

The source of truth is two documents in this folder. Read both completely before writing a line of code, and re-read the relevant section before each step:

- `PORTAL-SPEC.md` version 2: data model (§4), business rules (§5), screens (§6), WhatsApp links (§7), design (§8), build order (§9), acceptance criteria (§10), open questions (§11).
- `INTAKE-SPEC.md` version 2: the questionnaire as a generated JSON document, eight field types, the importer, the answers document, uploads, the image library.

Where those two documents and anything else disagree, they win. Where they and this file disagree, this file wins only in §5 below (decisions taken after they were written) and nowhere else.

Reference material, for layout and tone only, never for behaviour: `reference/mocks/*.dc.html` (one page per screen; `ClientReady`, `ClientAgreed` and `AdminStage` predate version 2 and show a per-stage button that no longer exists), `reference/awtm-portal-screens.html` (all screens on one canvas), `reference/awtm-dummy-site.html` (the marketing site to port), `reference/awtm-funnel.html` and `reference/awtm-pipeline.html` (planning pages, superseded on the payment model). `image-library/logo-directions/` holds six images to seed the image library.

## 2. Non-negotiables

These hold in every step, every file, every commit. A pull request that breaks one is not done, whatever else it does.

1. Money is an integer in paise, everywhere. Never a float, never a string with a symbol in the database.
2. `agreement.internal_cost_paise` and `agreement.internal_notes` never reach a client. They are stripped by one serializer that every `/p/`, `/invoice/`, `/agreement/` route, export and WhatsApp template must go through. Write the test for acceptance criterion 8 in the same commit that adds the fields.
3. No table, column, form, log line or upload can hold a secret belonging to a client's own systems: no passwords, API keys, OTPs, card numbers, access credentials. The intake's access section is checkboxes only; the importer refuses `upload` fields in that section (INTAKE-SPEC §5). If a feature seems to need a client secret, it is out of scope; write it in `QUESTIONS.md` and move on.
4. No live credential of ours in the repo, in a prompt, in a log, or in a message to Rahul. `.env.example` lists names and a one-line meaning for each; `.env` is gitignored. Never ask Rahul or Ayush to paste a key into the chat. Everything that needs a real value is done by Ayush on his own machine or in the Hostinger panel, from `DEPLOY.md`.
5. `signoff_event`, issued invoices and `review_round` rows have no update or delete path. Not in the API, not in the admin, not in a migration.
6. Invoice numbers are allocated inside the same transaction that issues the invoice, sequential per Indian financial year, never reused, never skipped, and concurrency-safe. Test it with parallel issuance.
7. Marketing routes are statically generated and never touch the database. Confirm by stopping MySQL and loading `/`.
8. `/p/`, `/admin/`, `/invoice/`, `/agreement/` send `X-Robots-Tag: noindex, nofollow`, the meta tag, `Cache-Control: no-store`, and are disallowed in `robots.txt`.
9. The client is never shown more than one thing to do. One column, no navigation, no sidebar, no tabs. On a 375 px screen every client page has exactly one primary action above the fold.
10. No em dashes anywhere: copy, comments, commit messages, docs. Use a comma, a colon or a full stop.
11. No puppeteer, no headless Chrome. Printable routes are print-styled pages.
12. Do not build anything in PORTAL-SPEC §2 (non-goals). No passwords for clients, no chat, no task management, no payment gateway, no referral mechanism beyond the single field in §5.1, no per-milestone anything, no form builder, no questionnaire editing in the portal.

## 3. How to work

Follow PORTAL-SPEC §9 in order. Twelve steps. Each step is a loop:

1. Re-read the sections of the specs that the step touches. Write a short plan for the step at the top of your reply: files, schema changes, tests.
2. Build it. Small commits with plain messages in the form `step 05: agreement editor and client page`.
3. Test it. Unit tests with Vitest for rules and serializers; end-to-end tests with Playwright for every client screen and every admin action. Every acceptance criterion in PORTAL-SPEC §10 and INTAKE-SPEC §14 that the step makes testable gets a test in that step, not later.
4. Run the whole suite, typecheck and lint. Fix what breaks before moving on.
5. Update the documentation the step touched, in the same commit: `docs/DATA-MODEL.md` for any migration, `docs/DFD.md` for any new flow or store, `docs/SEQUENCES.md` if an order changed, `docs/ARCHITECTURE.md` and a new ADR for any structural choice. Then update `BUILD-LOG.md`: the step, what was built, which acceptance criteria now pass, what is deferred and why.
6. Report in the fixed format in §7, then start the next step without waiting.

Do not skip ahead, do not merge steps, do not leave a step "mostly done". If a step cannot be finished, say exactly what is missing in `BUILD-LOG.md` and continue with the next step only if it does not depend on the gap.

When you hit a question the specs and this file do not answer: do not stop and do not guess silently. Write it in `QUESTIONS.md` as the question, two or three options, what each costs, and the option you are taking for now, then take that option and continue. Rahul reads `QUESTIONS.md` and answers there. The only things that stop the build are the credential boundaries in §6.

Sessions get compacted or restarted. `CLAUDE.md`, `BUILD-LOG.md` and `QUESTIONS.md` are how you re-orient. Keep them accurate at every step, never only at the end.

## 4. Stack and environment

Exactly as PORTAL-SPEC §3. Next.js App Router with TypeScript and `output: 'standalone'`; Tailwind; MySQL 8 via Prisma; nodemailer over SMTP for the one-time code, the link email and the team notifications, nothing else; Hostinger Cloud Professional Node.js app deployed from GitHub.

Repository. This folder is the repo. The front half (§9 steps 1 to 4) was built here on 5 September under the first brief: scaffold, tokens, the marketing site ported, schema and migrations, client login by code, admin auth, projects, the questionnaire importer with unit tests, and deploy notes. Build on it; do not scaffold again and do not create a second app. Where a front-half choice already works and breaks no non-negotiable, keep it and record the difference from this brief in `BUILD-LOG.md` rather than reworking it now; migrate front-half logic into `src/modules/` in the step that next touches each area (docs/ARCHITECTURE.md, folder layout).

Local database. Run MySQL 8 with Docker Compose (`docker-compose.yml` in the repo, database `awtm`, a dev user, a named volume). If Docker is not available, install MySQL locally. Never substitute SQLite or Postgres, even for tests: the numbering and transaction tests must run on the engine production runs on.

Email in development. When `SMTP_HOST` is unset, the mailer writes the message to the server log instead of sending, and the one-time code appears there. There is no route that reveals codes, in any environment.

Environment variable names, all in `.env.example`, none with values. The front half already defines `DATABASE_URL`, `SESSION_SECRET`, `UPLOAD_DIR`, `APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`; keep those names, `DEPLOY.md` already uses them. Add `TEAM_NOTIFY_EMAIL` (where team notifications go) and `TZ` (Asia/Kolkata) when the steps that need them arrive, with a one-line meaning each.

Admin accounts. Two. The front half has `scripts/admin-create.ts`; it must never generate and print a password. If it does today, change it in step 5 so it prints a one-time setup link to the log and the person sets their own password on opening it.

## 5. Decisions taken after the specs were written

These resolve PORTAL-SPEC §11 and the gaps found while writing this brief. They are defaults so the build does not stall; Rahul can override any of them in `QUESTIONS.md` before the step that uses it. Each one names the decision, why, and what it costs.

- Advance percentage: `company.default_advance_pct` seeded at 50, editable in settings, never hard-coded. Cost: none; the number changes in one place.
- One-time code by email, not SMS. SMS needs a provider and KYC. Cost: a client whose email is wrong on the intake cannot sign off until admin fixes `signoff_person_email`; admin can edit it.
- Both admins have the same permissions. Cost: none now; a role column can be added later without a migration of data.
- Booking: `company.booking_url` in settings. When empty, the "Book a sync" button is hidden, not broken.
- A project cancelled mid-build: add a terminal phase `cancelled`, reachable by admin from any phase except `delivered` and `closed`, with a required reason. It creates no invoice, changes no issued invoice, and the client page shows "This project was closed on [date]" with the WhatsApp footer. Cost: one enum value and one admin action.
- Currency: version 1 invoices are INR only. International pricing in AED and USD exists in the offers but is quoted by hand until a later version. Do not add a currency column now.
- Timezone: all dates, the financial year boundary and invoice dates are computed in Asia/Kolkata.
- Team notifications: when a client submits the intake, pushes back on the agreement, agrees, requests changes, signs off delivery, sends the thank-you page, or approves day 30, send one plain-text email to `TEAM_NOTIFY_EMAIL` naming the project and the event, with the admin link. Never includes internal cost. Cost: reuses the mailer; no new dependency.
- The marketing site's enquiry form (the draft says "wire to real storage before launch, never mailto"): store each submission in an `enquiry` table via an API route and email it to `TEAM_NOTIFY_EMAIL`. The static page itself still fetches nothing. Rate limit per IP. No third-party form service.
- Case study slots: the site draft shows two "awaiting the facts" slots. Hide them in the production build; keep the VRG EV card. Nothing is invented to fill them.
- Prices on the marketing site: keep the draft as it is. Do not add figures; that decision is Rahul's.
- The "How we work" section of the marketing site is replaced with the copy in §8 of this file, because the draft describes four stage gates and a 30 / 30 / 30 / 10 split that no longer exist.
- Uploads: stored under `UPLOAD_DIR` outside the web root, served only through an authenticated route, validated by magic bytes, images re-encoded and EXIF stripped, SVG sanitised, per INTAKE-SPEC §4.
- Seed data: one company row (name awtm forge, Bengaluru, prefix `AWTM`, `gstin` null, advance 50, booking URL empty), the six image library rows from `image-library/logo-directions/` keyed `logo-wordmark`, `logo-monogram`, `logo-emblem`, `logo-mascot`, `logo-abstract`, `logo-combination`, and one realistic project in `building` per PORTAL-SPEC §9 step 2, using a fictional client. Never seed a real client.

### 5.1 Decided by Rahul on 7 Sep 2026 from his flow diagram

These four are not defaults; they are decisions. They extend PORTAL-SPEC §4, §5 and §6, and the fourth overrides the referral line in PORTAL-SPEC §2. Build them in the step that owns the screen they touch.

- **The link is sent twice.** Creating a project sends one email from `MAIL_FROM` to `client.signoff_person_email`: subject "Your awtm forge project page", the link, and that it takes about ten minutes. The admin project page still offers the prefilled WhatsApp message from PORTAL-SPEC §7, and Rahul sends that himself. Record `project.link_emailed_at`. A mail failure does not block creation; the admin page shows "Email not sent" with a retry. Belongs to step 3.

- **The client can push back on the agreement inside the portal.** On `/p/[token]/agreement` while the phase is `agreement_sent`, under the primary "I agree" button there is a quieter second action, "Something is off", which opens one text box and a "Send" button. Submitting creates an `agreement_note` row (`project_id`, `agreement_version`, `text`, `created_at`, `entered_by` = client) and moves the phase back to `agreement_draft`; the team notification fires. Admin sees every note beside the editor, in order, with the version each one answered. Re-sending increments `version` exactly as PORTAL-SPEC §5.4 says. No code is required to push back; only agreeing needs one. Notes are append-only. There is no reply field, no thread: Rahul answers by editing the agreement or on WhatsApp. Belongs to step 5. Phase rule added to §5.2: `agreement_sent → agreement_draft` by a client `agreement_note`.

- **A thank-you page after the delivery sign-off, with the first testimonial ask.** When the delivery code is accepted, the client lands on `/p/[token]/thanks` once. Its heading is "Thank you. It is delivered." It carries exactly two optional fields and one button: a quote box, "One or two lines on how this went, in your words. Optional."; a referral field, "Know someone with the same problem? Their name and how to reach them, and we will mention you. Optional."; and "Send", with a "Skip" link. Submitting empty is allowed. After that the project page behaves as PORTAL-SPEC §6.1 describes for `delivered`. The quote is stored as a `testimonial` row with `moment = delivery`. Day 30 stays exactly as specified and stores `moment = day30`; when a delivery quote exists, the day-30 draft is prefilled from it so the client edits rather than starts again. Model: one `testimonial` table (`project_id`, `moment` enum `delivery | day30`, `text`, `use_name`, `use_logo`, `status` enum `draft | approved`, `created_at`, `approved_at`), replacing any separate day-30 quote column. The delivery quote is `draft` until the client approves it on the day-30 page or admin marks it approved after asking on WhatsApp (recorded with `method` like a sign-off). Only `approved` testimonials ever appear anywhere outside admin. Belongs to step 8 for the page and step 10 for the day-30 prefill.

- **Referral, in its smallest form.** The referral field above writes a `referral` row (`project_id`, `name`, `contact`, `created_at`). This overrides the "deliberately parked" line in PORTAL-SPEC §2. Rules: it appears only on the thank-you page, once; it is shown only in admin, on the project and in a small list on the projects page; it never appears on any client route after submission, in any export, or in any WhatsApp template; admin can delete a referral row, because it holds a third party's name and contact and that person never consented to being stored (this is the one deliberate exception to the no-delete rule, which covers evidence rows, not other people's details). No rewards, no tracking links, no referral codes on the enquiry form. Belongs to step 8.

Acceptance criteria added by this section, numbered on from PORTAL-SPEC §10: 22, creating a project sends exactly one link email and records `link_emailed_at`, and a mail failure leaves the project created with the warning visible. 23, an `agreement_note` moves `agreement_sent` to `agreement_draft` and cannot be created in any other phase. 24, `/p/[token]/thanks` returns 404 before the delivery sign-off and renders after it. 25, a `referral` row never appears in the body of any `/p/` route, export or WhatsApp template. 26, a `testimonial` with `status = draft` never appears outside `/admin/`.

## 6. The two credential boundaries

The build stops at exactly two points, and only these:

1. Deployment. When step 12 is reached, write `DEPLOY.md`: a runbook Ayush follows on his own machine and in the Hostinger panel, covering the Node.js app creation, the GitHub connection, the MySQL database and user, every environment variable by name, `prisma migrate deploy`, the standalone build command, the `hello@awtmforge.com` SMTP settings by field name, the domain, and a nightly `mysqldump` note. Then tell Rahul the build is ready to deploy and stop. When Rahul replies that it is deployed, run the production checks: acceptance criteria 17, 18 and 19 with curl against the live domain, a full client journey on the seed project, and a real one-time code delivered to a test address Ayush controls. Fix what fails, republish, and stop.
2. Nothing else. Everything before step 12 runs on the local database and the log mailer.

Never ask for a value that belongs in `.env`. If something cannot proceed without one, it belongs after boundary 1, and `DEPLOY.md` is where it is described.

## 7. Report format, after every step

Five lines, then the next step begins:

```
Step N, <name>: done | partial
Built: <files and behaviour, one line>
Verified: <tests run, acceptance criteria now passing by number>
Deferred: <what and why, or none>
Needs Rahul: <QUESTIONS.md entries added this step, or none>
```

Plain prose, no em dashes, no adjectives about the work. Describe the work as AI-assisted where it comes up; the judgement in the specs is Rahul's and Ayush's.

## 8. Copy for the "How we work" section

Replaces the whole section in `reference/awtm-dummy-site.html` when the site is ported. Drafted 7 Sep 2026 for the one-agreement model. Rahul approves the wording before launch; until then this is what ships to staging. Everything else on the site is ported as written.

Section title: The same loop, once.

Intro: Before we start, we write down together what finished looks like, one deliverable at a time, with how you will check each one. While the build runs, you can open it on a real link whenever you want. At the end you check it against what we wrote. If it holds, you sign off and we invoice the balance. If it does not, we keep working, and we do not invoice.

01, Agree the shape. One call, then one page: what we are building in your words, each deliverable and how you will check it, what is not included, the dates, the price and how it splits. You read it and you agree to it once, before anything starts. After that, the only thing we ask you to sign is the delivery itself.

02, Something you can open. By day ten there is a real link, not a screenshot. It will be rough, and that is the point. You correct us while correcting is still cheap.

03, The build. A short written update every week whether or not anything went wrong, and a call every two weeks that either of us can book. You always know what moved, what is next, and what we need from you and by when.

04, Delivery, and the month after. You check the work against the page you agreed to. If something is off, you say so in one box and we keep going, as many rounds as it takes. When it holds, you sign off, the balance is invoiced, and either we run it monthly or we hand over with everything documented and every access transferred. Quietly vanishing is not one of the options.

The four tiles under it:

A price, not a rate. One number for the whole thing, agreed before anyone starts. No meter running, no surprise at the end.

Paid on your sign-off. An advance when you agree, the balance when you have signed off the delivery. Nothing in between, and nothing invoiced for work you have not accepted.

A founder throughout. The person on your first call runs your project to the last invoice. You are never handed to someone you have not met.

We do not discount. If the budget does not fit, we cut scope and tell you exactly what you are losing. New work gets a new number, agreed before it begins.

FAQ answer to replace, "How do I know it will get finished?": Before we start, we write down what has to be true for the delivery to be signed off. We do not invoice the balance until you have signed it off. That is in the agreement you read, not just on this page.

## 9. Voice, for every string a client reads

Second person, short sentences, plain words. Say the price, the date and what finished means. Say what is not included. No "solutions", "seamless", "leverage", "end-to-end", "one-stop". No adjectives doing a fact's job. Buttons say what happens: "I agree", "Sign off the delivery", "Send it". Errors say what went wrong and what to do. Never Zyphex Tech anywhere.

## 10. Definition of done

The job is finished when all of these are true: every step in PORTAL-SPEC §9 is marked done in `BUILD-LOG.md`; every acceptance criterion in PORTAL-SPEC §10 and INTAKE-SPEC §14 has a passing test or a recorded manual check with the date; `QUESTIONS.md` has no entry without a decision; the documentation set in §12 is complete and matches the code; `DEPLOY.md` exists and Ayush has followed it; the production checks in §6 pass on awtmforge.com; and the last message to Rahul is the report format with "Step 12, deploy: done".

## 11. Architecture, and the room left for later

`docs/ARCHITECTURE.md` is the design; read it after the specs and before step 1. The short version, which is binding:

- **Domain modules, thin routes.** Business behaviour lives in `modules/`, one folder per area, with no HTTP and no React in it. A route validates input with zod, calls a module, renders a view. No route file imports `prisma`.
- **One phase machine.** `modules/projects/phase.ts` holds the transition table (from, event, to, side effects). Every phase change goes through `transition()`. Nothing else writes `project.phase`.
- **Activity events for side effects.** Every meaningful change writes an `activity_event` and emits it through the in-process dispatcher in `modules/events`. Emails, WhatsApp templates and the needs-attention block are subscribers in `modules/notifications`. New side effects are new subscribers, never new lines in the module that made the change. `signoff_event` stays separate as legal evidence.
- **Serializers per audience.** `modules/serializers` is the only way an entity reaches a view, a template, an export or the event log. Client and print shapes cannot contain internal cost, internal notes, friction notes or referral contacts; the type system refuses a raw model.
- **Typed settings.** `setting` is a key-value table read through one function; a new setting is a key with a default, not a migration.
- **Versioned intake documents.** `modules/intake/versions/v1.ts`; a later version is a sibling file chosen by `document.version`.
- **Validation at the boundary, migrations additive in production, evidence rows append-only.**

The seams for later features are listed in `docs/ARCHITECTURE.md` under "The seams where new features attach": a new journey step, a new side effect, a new channel, a payment gateway, a new field type, multi-currency, roles, the referral programme, a second contact. When a feature request arrives, the answer is the seam it attaches to; if none fits, that is an ADR before it is code.

What is deliberately not built: a queue, a separate API, microservices, GraphQL, a repository layer over Prisma, feature flags beyond a boolean setting. Two founders and one node; the architecture matches the team. Do not add any of these without an ADR that names the problem they solve.

Use the engineering practices that fit: TypeScript strict, zod at every boundary, small pure functions for money and dates, tests beside the rule they protect, a CI that blocks deploy on red, structured logs with a request id, `/healthz`. Do not add a practice because a checklist has it; add it because a failure it prevents is plausible here.

## 12. Documentation, what exists and what the build produces

`docs/` is part of the deliverable. It is kept true at every step (§3, loop item 5), not written at the end.

Already written, before the code, and to be corrected as the code teaches better:

- `docs/ARCHITECTURE.md`: zones, boundaries, folder layout, seams, principles applied and not, quality gates, operations.
- `docs/DFD.md`: level 0 context diagram and level 1 process diagram, with the money and personal-data flows called out.
- `docs/DATA-MODEL.md`: entity relationship diagram, the rules the schema enforces, the phase state diagram, what is not modelled yet.
- `docs/SEQUENCES.md`: first visit, agreement sign-off, review and delivery, invoice numbering under concurrency.
- `docs/adr/`: nine accepted decisions and the template. Every structural choice made during the build gets the next number.

Produced by the build, each in the step that owns it:

- `README.md` at the repo root (write it in the next step, since the front half did not): what this is, how to run it locally in five commands, how to run the tests, where the docs are. The handover map that used to sit there is now `docs/HANDOVER.md`.
- `docs/API.md` (step 3 onward): every route with method, zone, auth, request and response shape, and which acceptance criteria cover it. Generated from the zod schemas where possible.
- `docs/RUNBOOK.md` (step 11): the admin actions with a line each (create project, upload questionnaire, rotate link, record a WhatsApp sign-off, cancel, mark paid, approve a testimonial, delete a referral), plus restore-from-backup, tested once.
- `DEPLOY.md` (step 12): the runbook for Ayush, §6.
- `BUILD-LOG.md` and `QUESTIONS.md`: from the first commit.
- `CHANGELOG.md`: one line per step, dated.

Diagrams are Mermaid in fenced blocks so GitHub renders them and no image goes stale. Every document carries the date it was last checked against the code. Prose rules for all of it: plain, second person where it instructs, no em dashes, no adjectives about the work, AI-assisted where authorship comes up.
