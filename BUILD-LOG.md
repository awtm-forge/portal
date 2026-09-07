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

---

## Where the front half differs from CLAUDE.md §11, and where each is folded

The front half was built on 5 September under a brief that predated the architecture document. Nothing below breaks a §2 non-negotiable, so none of it is reworked now. Each row names the step that takes it.

| Difference | Fold into |
|---|---|
| No `src/modules/`. Domain logic sits in `src/lib/` (`client-auth.ts`, `admin-auth.ts`, `intake/`, `files.ts`, `storage.ts`, `whatsapp.ts`). | Per area, in the step that next touches it. Auth, notifications and serializers in step 5; intake at its next change. |
| Some route files and server actions import `db` directly, against the "no route imports prisma" rule. | The same step that migrates each area. Project and agreement routes in step 5. |
| No phase machine and no `project.phase`; the client landing state is derived from the intake. | Step 5. `modules/projects/phase.ts` with the transition table from `docs/DATA-MODEL.md`. |
| No `activity_event`, no dispatcher, no notifications module. | Step 5. |
| No serializers module. Internal cost does not exist yet, so nothing leaks today, but §2 rule 2 says the test ships with the field. | Step 5, in the same commit as `agreement.internal_cost_paise`. |
| No `company` or `setting` tables; no settings screen. | Step 5, which needs the invoice prefix and the advance percentage. |
| Intake validators are in `src/lib/intake/`, not `modules/intake/versions/v1.ts`. | The next step that changes intake behaviour. |
| The Prisma client is not wrapped to hide update and delete on evidence tables. | Step 5, when `signoff_event` and `agreement_note` arrive. |
| Unit tests only. No Playwright, no CI. | Step 5 sets both up and covers the screens built so far as well as the new ones. |
| No `/healthz`, no structured logging with a request id. | Logging in step 11, `/healthz` in step 12 where Hostinger's monitor needs it. |
| `scripts/admin-create.ts` reads a password from the terminal with echo off. It never generates or prints one, so §2 rule 4 holds, but §4 asks for a one-time setup link instead. | Step 5, as §4 says. |
| Local database was a hand-run container named `awtm-mysql` on the database `awtmforge`. | Done now: `docker-compose.yml` with database `awtm` and a named volume. |

Naming differences from `docs/DATA-MODEL.md` that are cosmetic and are aligned when the table is next touched: `LoginCode` becomes `one_time_code` with the purpose enum `login, agreement, delivery` (step 5); `IntakeFile` keys off `projectId` rather than `intakeId`; `ImageLibrary` has an id with `key` unique rather than `key` as the primary key, and `caption` rather than `label`.

Two deliberate departures, kept:

- `AdminUser.passwordHash` is bcrypt, not argon2. `docs/DATA-MODEL.md` says argon2; PORTAL-SPEC §6.6 says "argon2 or bcrypt". The spec wins under `CLAUDE.md` §1, so bcrypt stays and the data model note is the one that is out of step.
- `Enquiry` carries `contact` and `adSpend` beyond the four fields in `docs/DATA-MODEL.md`. The site's form asks for ad spend, and without a contact field there is no way to answer an enquiry. Kept.

## Where the front half differs from CLAUDE.md §5.1

All four decisions postdate the front half. None is built.

| Decision | Step that takes it |
|---|---|
| The link is sent twice: one email on project creation, plus the prefilled WhatsApp message. `project.link_emailed_at`, and an "Email not sent" retry on the admin page. | Step 5 |
| The client can push back on the agreement: `agreement_note`, phase back to `agreement_draft`, no code required. | Step 5 |
| The thank-you page after delivery sign-off, with the first testimonial ask and the referral field. `testimonial` table with `moment`. | Step 8, day-30 prefill in step 10 |
| Referral in its smallest form, admin-only, deletable. | Step 8 |
