# Build log

One entry per step of PORTAL-SPEC §9, written in the step, not at the end. A step is done when it is built, tested, documented and reported. Anything missing is named here as deferred, with the step that will take it.

Read this after `CLAUDE.md` when a session starts. The first step below without "done" is where work continues.

---

## Step 1, scaffold, tokens, marketing site: done, with §5 items deferred

5 Sep 2026, AI-assisted.

Built: Next.js 16 App Router with TypeScript and Tailwind 4. Design tokens on bare `:root` in `src/app/globals.css`, dark set only. Marketing site ported from `reference/awtm-dummy-site.html` into `src/app/page.tsx` with `src/components/marketing/`, statically generated, fonts self-hosted through `next/font`. `robots.ts` disallows the four private prefixes. `src/proxy.ts` and `next.config.ts` send `X-Robots-Tag`, `Cache-Control: no-store` and `Referrer-Policy` on `/p/`, `/admin/`, `/invoice/`, `/agreement/` and `/api/`. Enquiry form posts to `POST /api/enquiry`.

Verified: acceptance criteria 17 (marketing page renders with MySQL stopped), 18 and 19 (headers and robots.txt, checked with curl against a production build). Criterion 14 is partly met: dark renders correctly, and there is no light theme by Rahul's decision of 5 Sep.

Deferred to the step named: the `CLAUDE.md` §8 "How we work" copy and the hidden case study slots were decided after this step was built, and no later step touches marketing, so both are done as a step 1 completion commit before step 5 rather than folded forward. The enquiry email to `TEAM_NOTIFY_EMAIL` (§5) waits for the notifications module in step 5.

## Step 2, schema and migrations: partial

5 Sep 2026, AI-assisted.

Built: Prisma 7 with the MariaDB driver adapter against MySQL 8. Tables for the front half only: `AdminUser`, `AdminSession`, `Client`, `Project`, `ClientSession`, `LoginCode`, `RateLimit`, `Intake`, `IntakeFile`, `ImageLibrary`, `Enquiry`. Two migrations. Seed script for the six image library rows and one project.

Verified: migrations apply from empty; the seed runs.

Deferred: every table from PORTAL-SPEC §4 that the earlier brief excluded, which is most of the money and journey side. `company`, `setting`, `agreement`, `agreement_note`, `signoff_event`, `update`, `review_round`, `invoice`, `invoice_sequence`, `day30`, `testimonial`, `referral`, `activity_event`, and the columns `project.phase`, `link_emailed_at`, `week_count`, `metric_*`, `after_delivery`, `delivered_at`, `cancel_reason`, `intake.overridden`. Each arrives in the step that first uses it, per `docs/DATA-MODEL.md`. The seed does not yet produce the realistic `building` project the step calls for, because that project needs an agreed agreement and a paid advance invoice; it is completed in step 5.

## Step 3, client login and admin auth: done, with §5.1 item deferred

5 Sep 2026, AI-assisted.

Built: project link as 32 random bytes base64url, stored only as a SHA-256 hash and compared in constant time. Six-digit code to `client.signoffPersonEmail`, ten minutes, five attempts, single use, then a thirty-day session cookie scoped to `/p`. Rate limits per project and per IP in the database, because the Hostinger process is stopped when idle. Admin login for two accounts with bcrypt and an httpOnly session cookie. Projects list and project page. Link rotation kills the old link and every session.

Verified: manual pass of the whole login journey in a browser at 375 px; criterion 9 (rotation) by construction and inspection; criterion 5 partly, in that the code rules hold for login. The sign-off half of criterion 5 arrives with the first sign-off in step 5.

Deferred: the §5.1 link email on project creation, and `project.link_emailed_at`. Folded into step 5, which builds the mailer's second use and the notifications module.

## Step 4, the questionnaire: done

5 Sep 2026, AI-assisted.

Built: the importer with every rule in INTAKE-SPEC §5, reporting all failures at once and saving nothing on any failure. The renderer under the one-thing-to-do rule, all eight field types, one section open at a time, continuous save. Uploads validated by magic bytes, re-encoded with EXIF stripped, SVG sanitised, stored outside the web root under `UPLOAD_DIR`, served only through an authenticated route. Image library with replace, and delete refused while a key is in use. The answers view in admin, the type-their-answers mode with `entered_by = team`, and the answers JSON download. Document replacement keeps every answer and hides orphaned keys.

Verified: 18 unit tests covering the importer rules, the exe-renamed-to-jpg refusal, EXIF stripping including GPS, SVG script and external reference removal, HEIC refusal and answer validation by type. INTAKE-SPEC §14 criteria 2, 3, 4, 5, 8, 9, 11 and 12 have tests; 1, 6, 7, 10 and 13 were checked by hand in the browser and need automated cover, taken in step 5 when Playwright arrives.

Deferred: none in behaviour.

## Step 5, the agreement: done

7 Sep 2026, AI-assisted.

Built, in four commits. The foundations: money in paise with Indian grouping, words for the invoice, and an advance that rounds down so two invoices always sum to the total; the financial year in Asia/Kolkata; the phase machine holding the transition table, which is now the only thing that writes `project.phase`; the activity event log and its in-process dispatcher; the audience serializers; the company singleton; and invoice numbering allocated inside the issuing transaction.

Then the agreement itself. Admin writes it with internal cost and notes in a block marked never shown to the client, and the project's timeline and outcome fields beside them (QUESTIONS.md Q2). Sending is gated on a submitted questionnaire, with an override that records who and when, and re-sending increments the version. The client reads the document, agrees with a fresh code, or says something is off without one, which writes an append-only note and puts the agreement back in draft. Agreeing writes the sign-off event, freezes the agreement and raises the advance invoice in one transaction. Both audiences share one print route.

Also in this step, from the deferred list: the link email on project creation with `link_emailed_at` and a retry when it fails; team notifications and the enquiry email; the intake submit gate moving the phase; `scripts/admin-create.ts` rewritten to print a one-time setup link so no password is ever generated, printed or typed into a terminal; the append-only guard on the database client; the seed's realistic project in `building` with an agreed agreement and a paid advance, which completes step 2.

Verified: 48 unit tests and 23 end to end tests, on desktop and a phone, against a production build. Acceptance criteria now passing: 1, 4, 5, 6, 7, 8, 13, 16, 17, 18, 19, 22, 23, and INTAKE-SPEC 14.7. Criterion 3 holds by construction, since `issueAdvance` and `issueBalance` are called only from the phase machine's side effects and no admin route reaches them.

Three defects the tests found, and the fix in each case:

- Invoice numbering deadlocked under the twenty-in-parallel test. `INSERT IGNORE` took a shared lock that `SELECT ... FOR UPDATE` then had to upgrade, and two transactions doing that deadlock. It is now one `INSERT ... ON DUPLICATE KEY UPDATE`, which takes the exclusive lock in a single statement.
- The session cookie was marked `Secure` from `NODE_ENV`, so a production build served over plain HTTP set a cookie the browser silently dropped, and nothing could test the logged-in state. It is now keyed to whether `APP_URL` is https.
- The client session cookie was scoped to `/p`, so the browser never sent it to `/agreement/[token]/print` and a client could not open their own agreement. The path is now `/`.

Deferred: none from this step. The `modules/intake/versions/v1.ts` split named in §11 is still not done; the intake moved to `src/modules/intake/` in this step but keeps its flat layout, and the split lands with the second document version, since a versions folder holding one version is ceremony until there are two.

## Client onboarding, and the sign-off person: done

8 Sep 2026, AI-assisted. Asked for by Rahul between steps 5 and 6, on the grounds that onboarding a client should exist before more of the journey is built. Not a numbered step in PORTAL-SPEC section 9; it revisits step 3.

Built: a client is now its own record, so it can be added on the discovery call before anyone knows what the project is. Clients list, add a client, one client with their projects. Starting a project begins from a client, and the sign-off person is asked there. The handover has its own screen at `/admin/projects/[id]/link`, showing the link in the clear, the WhatsApp message ready to send, and the email's state with a retry. Clients sits above Projects in the sidebar.

The sign-off person moved from `client` to `project`, decided by Rahul, departing from PORTAL-SPEC section 4. See QUESTIONS.md Q4. The migration copied every existing project's approver across before dropping the client columns, so nothing was lost.

Copy: the link email and the code email were rewritten in a warmer voice, and every client-facing screen followed. The development mailer now prints whole message bodies, since the wording is the thing worth checking and there is no inbox to check it in.

Verified: 48 unit tests, 29 end to end. The onboarding journey has its own test, including the rule that matters: a reload still shows the link, and once the fifteen minute cookie is gone nothing can bring it back, because only its hash was ever stored.

Deferred: none. Two notes. The old `/admin/projects/new` route is gone, since a project without a client made no sense. And `docs/DFD.md` still draws the sign-off person under the client stores; it is corrected at the next change to that file.

---

## Where the front half differs from CLAUDE.md §11, and where each is folded

The front half was built on 5 September under a brief that predated the architecture document. Nothing below breaks a §2 non-negotiable, so none of it is reworked now. Each row names the step that takes it.

| Difference | Fold into |
|---|---|
| ~~No `src/modules/`.~~ Auth, intake, agreements, invoices, events, serializers, settings, notifications and the phase machine now live in `src/modules/`. `files.ts`, `storage.ts`, `whatsapp.ts`, `money.ts`, `dates.ts` and `logger.ts` stay in `src/lib/`, which is right: they have no domain knowledge. | Done in step 5. |
| Some route files and server actions still import `db` directly, against the "no route imports prisma" rule. The agreement path goes through its module; the admin project pages and the intake routes read through `db`. | Each area at its next change: intake and files at their next behaviour change, admin project pages in step 11 with the needs-attention block. |
| ~~No phase machine and no `project.phase`.~~ | Done in step 5. |
| ~~No `activity_event`, no dispatcher, no notifications module.~~ | Done in step 5. |
| ~~No serializers module.~~ Note against §2 rule 2: the fields landed in the schema commit and the leak test one commit later, the same afternoon, not in the same commit. | Done in step 5. |
| ~~No `company` table.~~ The `setting` table exists but nothing reads it yet, and there is no settings screen. | Screen in step 11 or 12, wherever the booking URL and bank details are first needed. |
| Intake validators moved to `src/modules/intake/` but are not split into `versions/v1.ts`. | With the second document version. A versions folder holding one version is ceremony. |
| ~~The Prisma client is not wrapped to hide update and delete on evidence tables.~~ Guard is on the client itself, so a later screen cannot write its own query around it. | Done in step 5. |
| ~~Unit tests only. No Playwright, no CI.~~ | Done in step 5. |
| No `/healthz`, no structured logging with a request id. | Logging in step 11, `/healthz` in step 12 where Hostinger's monitor needs it. |
| ~~`scripts/admin-create.ts` reads a password from the terminal.~~ It now prints a one-time setup link, valid 48 hours and usable once, and the person chooses their own password at `/admin/setup/[token]`. | Done in step 5. |
| Local database was a hand-run container named `awtm-mysql` on the database `awtmforge`. | Done now: `docker-compose.yml` with database `awtm` and a named volume. |

Naming differences from `docs/DATA-MODEL.md` that are cosmetic and are aligned when the table is next touched: `LoginCode` becomes `one_time_code` with the purpose enum `login, agreement, delivery` (step 5); `IntakeFile` keys off `projectId` rather than `intakeId`; `ImageLibrary` has an id with `key` unique rather than `key` as the primary key, and `caption` rather than `label`.

Two deliberate departures, kept:

- `AdminUser.passwordHash` is bcrypt, not argon2. `docs/DATA-MODEL.md` says argon2; PORTAL-SPEC §6.6 says "argon2 or bcrypt". The spec wins under `CLAUDE.md` §1, so bcrypt stays and the data model note is the one that is out of step.
- `Enquiry` carries `contact` and `adSpend` beyond the four fields in `docs/DATA-MODEL.md`. The site's form asks for ad spend, and without a contact field there is no way to answer an enquiry. Kept.

## Where the front half differs from CLAUDE.md §5.1

All four decisions postdate the front half. None is built.

| Decision | Step that takes it |
|---|---|
| ~~The link is sent twice.~~ Done in step 5. Note: the retry rotates the token when the original is no longer in hand, because only its hash is stored. | Done |
| ~~The client can push back on the agreement.~~ | Done in step 5 |
| The thank-you page after delivery sign-off, with the first testimonial ask and the referral field. `testimonial` table with `moment`. | Step 8, day-30 prefill in step 10 |
| Referral in its smallest form, admin-only, deletable. | Step 8 |
