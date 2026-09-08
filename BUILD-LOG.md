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

## Step 8, the review loop: done

8 Sep 2026, AI-assisted.

Built: `review_round`, `testimonial`, `referral` and `day30`, which completes every table in PORTAL-SPEC section 4. Admin marks the finished work ready, which opens a round and needs a link to it. The client sees what they agreed to with each how-to-check line, the link, one box for what is off and one button to sign off. Saying what is off needs no code, returns the project to building and invoices nothing. Signing off asks for a fresh code and, in one transaction, writes the sign-off event, closes the round, sets `delivered_at`, raises the balance invoice and opens the day-30 row thirty days out. Then the thank-you page, once, with an optional quote and an optional referral, and a Skip that is recorded like an answer.

Also here: the delivery half of the WhatsApp recording path that step 6 deferred, so criterion 6 now passes for both kinds; the `ready for review` message, which is the last of PORTAL-SPEC section 7 apart from day 30; and the `in_review` and `delivered` states on the client project page, the second showing the retainer's named person and response time or the handover document.

Verified: 56 unit tests and 63 end to end, on desktop and a phone. Acceptance criteria now passing: 2, 5, 6 for both kinds, 16, 24, 25 and 26. A manual pass at 375 px on the review page confirmed one action above the fold.

Three defects found and fixed:

- **A sign-off could happen twice.** See the entry below; it was serious enough to be its own commit before any of this was built.
- **The thank-you page threw away what the client typed.** React resets an uncontrolled form once a server action returns, so tripping the referral check erased the testimonial they had just written, moments after signing off. Every other form in the codebase echoes its values back; this one did not. It does now.
- **Two admin cards shared a heading**, so the mark-ready card and the kickoff card both read "the one thing that moves this on". The first is now "When the work is finished".

Deferred: none. `docs/ARCHITECTURE.md`'s folder layout assigns testimonials and referrals to `day30/`, and they are there, with `review/` calling into it. That keeps a testimonial's whole life, drafted at delivery and approved at day 30, in one module.

## Ready to deploy: healthz, a seed that is safe in production, a runbook that is true: done

9 Sep 2026, AI-assisted. Rahul asked to go live, which is the credential boundary in CLAUDE.md section 6.

Built: `/healthz`, which answers 200 only when the database answers and says nothing else. No version, no environment, no error text: it is reachable without signing in, and the detail belongs in the log.

Three things were wrong for a production deploy, and none would have shown up in a test:

- **`npm run db:seed` would have put two fictional projects into production**, with fictional clients, and printed a client link to the deploy log. A link is a bearer credential (PORTAL-SPEC 5.9), and there is no delete-project path by design, so both would have stayed for good. The company row and the image library are what production actually needs; the demo projects now need `--demo`, or a `NODE_ENV` that is not production.
- **`DEPLOY.md` still described a two-branch staging plan** where `main` held the marketing site alone and `front-half` was merged after. `front-half` was merged long ago and is twenty commits behind, and the marketing site is not routed any more. Anyone following that file would have deployed the wrong thing first.
- **It also pointed at `zekst/awtmforge`**, which now redirects, and it had no backup section at all, though CLAUDE.md section 6 requires the nightly `mysqldump` note. That is written now, with the uploads directory beside it, because the dump does not include it.

Also added to the checks: a `/healthz` curl, and a real one-time code delivered to a real address, which is the only check that proves SMTP.

Verified: 85 unit tests, 79 end to end, the webpack build.

Deferred: steps 10 and 11 are not built, and `DEPLOY.md` now says so at the top rather than leaving it to be discovered. A project delivered today reaches its day-30 unlock in thirty days and finds nothing there. That is the deadline on step 10.

Needs Rahul: bank details at `/admin/settings` before the first invoice is printed, and Q7 on the GST rate before registering.

## The marketing site leaves the root, and the two portals get two hostnames: done

9 Sep 2026, AI-assisted. Two decisions from Rahul, both outside the step order.

**The marketing site is not served here.** Asked what "not needed" should mean, Rahul chose to keep the code and stop routing it. `src/app/page.tsx` moved to `src/components/marketing/MarketingSite.tsx`, still compiling, not routed. `/` is now a small way in: the project page opens from the emailed link, there is no password, and a quiet team sign-in sits under it. The whole host is private, so `robots.txt` is one `Disallow: /` and `/` joins the zones sending noindex and no-store. The zones are still listed one by one in `next.config.mjs` rather than as a catch-all, because a catch-all would also put `no-store` on Next's content-hashed static assets. ADR 0012.

**Two hostnames, one app.** `APP_URL` is where clients land, `ADMIN_URL` is where the team signs in, and `src/lib/hosts.ts` is the only thing that reads them. `src/proxy.ts` answers 404 for `/admin` on the client host and `/p/` on the team host, sends the bare team host to the projects list, and serves the printable routes on both because both need them. With `ADMIN_URL` unset the two run on one hostname and nothing is refused, which is what development and the tests do. ADR 0013.

Two deployments was offered and not taken, and this is the ADR that `CLAUDE.md` section 11 asks for: it would buy isolation the serializers already provide, at the cost of two builds, two deploys and shared code either duplicated or packaged.

Verified: 17 more unit tests, and the full end to end suite. The leak walk now asserts the root is the way in rather than the marketing page, and that robots disallows the host rather than four prefixes.

One thing worth saying plainly: this is not a security boundary. Anyone who learns the team hostname reaches its login page. What keeps a client's data out of the team's views, and internal cost out of the client's, is the serializers and the session checks, exactly as before.

Where this leaves the written brief: `CLAUDE.md` section 1 and PORTAL-SPEC section 9 step 1 both describe three zones on one domain, and are now out of step. The rule in `CLAUDE.md` section 2 item 7, that marketing routes never touch the database, has nothing to apply to on this host, though the check it names still passes: the way-in page reads nothing either. `docs/API.md`, `docs/ARCHITECTURE.md` and `DEPLOY.md` are updated; the specs are Rahul's to change.

## Step 9, invoice numbering, mark paid, print route: done

8 Sep 2026, AI-assisted.

Built: the printable invoice at `/invoice/[id]/print`, per PORTAL-SPEC 6.7: company block, client block, number and date, the line naming the project, the total in figures and in words, bank details, and a GST block that appears only once `company.gstin` is set. It takes print views only, so internal cost has no way onto the page. An admin can open any invoice; a client can open their own, and gets a 404 for anyone else's.

Mark paid is the one thing that moves on an issued invoice. The date must read, must not be in the future and must not be before the invoice was raised, and the write is conditional on the invoice still being issued, so two admins marking the same one at once record one payment and one event. Raising an extra is the only invoice an admin can raise by hand, per criterion 3: no route reaches `issueAdvance` or `issueBalance`, and both of those still follow a sign-off and nothing else.

Numbering itself was built in step 5 and is unchanged. Criterion 4 was already covered by `tests/invoice-numbering.test.ts`, including twenty issued in parallel with no duplicate and no gap, and a rollback that consumes no number.

Verified: 68 unit tests and 77 end to end, on desktop and a phone, plus the production build on webpack. Acceptance criteria now passing: 3, 12 and, for the invoice print route, 8 and 18. The leak walk now includes every invoice on the seed project.

Six defects found and fixed:

- **The team email for an extra invoice would have named the description where the amount goes**, so a notification would have read "Extra invoice AWTM/26-27/003 for Two extra photography sets" with no sum in it. Caught by reading the payload against the subscriber, not by a test.
- **The admin invoice list never showed the description**, so two extras were indistinguishable from each other. The line is now shown for `other`, where it is the only thing that says what the invoice is for. Advance and balance already carry the project name in theirs. Found by an end to end test that could not tell which invoice it had just raised.
- **The invoice reads and the date validation sat in the route**, against the CLAUDE.md section 11 rule that no route imports prisma. Both moved into `modules/invoices`, and the admin page's invoice read now goes through `forProject` as well, folding in part of the debt recorded below.

- **Raising an extra was hidden behind an unrelated condition.** The invoices card only rendered once the project had an invoice or an agreed agreement, and the raise control sat inside it, so on a project with neither there was no way to raise an extra at all. Nothing in PORTAL-SPEC 5.1 ties an extra to the agreement. The card is now always there. Found by the phone run of the full suite, not by the spec run on its own.
- **The printed invoice said the project name twice**, once as the line item and again inside the description, because `issueAdvance` and `issueBalance` put it in the description and every screen that shows a description shows the project beside it. The descriptions are now just "Advance, 50 percent of the agreed total" and "Balance, on sign-off of the delivery". Found by looking at the page at 375 px, not by a test. Invoices already issued keep the wording they were issued with, which is correct: the guard does not let a description change.
- **My own end to end spec was not independent.** It acted on whichever invoice an earlier spec happened to leave on the seed project, so it passed alone and failed twelve ways in the full run. It makes its own invoice now. Worth recording because the first full run appeared to pass: the command piped the runner into `tail`, so the shell reported `tail`'s exit code and the failures scrolled past. Test commands are not piped any more.

One thing that was not a defect, recorded because it looked like one: a client signed in to a second project could open the first project's invoice in the same browser. Sessions are cookied per project on purpose, so one device may legitimately hold several, and `currentClientSession` checks the session's own project. The test was reusing a browser context that still held the first session. It uses a fresh context now.

Deferred: none for the step. Two questions added, Q7 on what tax rate to charge once a GSTIN exists, and Q8 on the bank details being empty, which the admin invoice list now says out loud.

## Fixing a client bundle that reached for node:crypto: done

8 Sep 2026, AI-assisted. Found while integrating Ayush's build fix, not by a test.

Ayush changed the build to webpack, because Hostinger's build host has glibc older than 2.29 and Next falls back to WASM there, which has no Turbopack. Everything up to step 8 was built with Turbopack, which tolerated something webpack refuses: `src/lib/whatsapp.ts` imported `phoneDigits` from `src/lib/crypto.ts`, and `UpdateForm.tsx` is a client component that imports `whatsapp.ts`. So the browser bundle pulled in `node:crypto` and the build died on it.

`phoneDigits` is a pure string function that was in the wrong file. It moved to `src/lib/format.ts` and `crypto.ts` is now server-only in fact as well as intent. No behaviour changed.

Worth saying plainly: this would have failed on Hostinger the first time anyone deployed, and no test in the suite would have caught it, because the tests run a Turbopack build. `npm run build` is the check that catches this class of thing, and it now runs on the same bundler production runs on.

Verified: `npm run build` with webpack, then the full suite against that build.

## Fixing a sign-off that could happen twice: done

8 Sep 2026, AI-assisted. Found while designing step 8, and committed on its own before it.

`agree()` read the project, checked the phase and then wrote, with nothing holding the row in between. Two callers could both pass the check on their own snapshot and both write a sign-off event and an invoice. In the portal the one-time code's single-use check hid this by accident; the WhatsApp recording path from step 6 had no such guard, so two fast submits of that form could raise two advance invoices. Criteria 1, 2 and 6 all depended on something that was not there.

`transition()` now writes the phase conditionally on it still being what the caller read, throws when it matches no row, and is called first inside each sign-off transaction. The loser rolls back before writing anything and is told the thing is already agreed or already delivered, which is true from where it stands. Side effects branch on the transition's declared effects, so the table in `phase.ts` is load-bearing rather than a comment. ADR 0011.

This also closes the CLAUDE.md section 11 rule that every phase change goes through one function: the six places that wrote `project.phase` themselves now call `transition()`, and the kickoff moved out of a route file into `modules/projects`.

Verified: `tests/signoff-concurrency.test.ts` runs two sign-offs in parallel and asserts exactly one event and one invoice. It fails against the previous implementation.

## Step 7, weekly updates, the booking button and the WhatsApp links: done

8 Sep 2026, AI-assisted.

Built: the `update` table and its module. An update is a draft until it is sent, and frozen afterwards, because a client has read it by then and one that quietly changes is worth less than one that does not exist. The week to write is one after the last, or for the first update whichever week the calendar says the build is in, so a project that started three weeks ago opens on week four rather than week one.

Admin gets the five fields, the same five every week, with the WhatsApp message built live from what is typed so the page and the message cannot disagree. Marking the kickoff done is the one action that moves a project from agreed to building, and it is the only loud thing on the project page while that is true.

The client gets the current week in full under a "Week 4 of 8" line, with earlier weeks below it and collapsed. The Book a sync button appears only when a booking link is set, and is hidden rather than broken when it is not.

Also in this step, because the booking link had nowhere to live: the settings screen. Company details, bank details, invoice prefix, GSTIN, booking URL and the default advance percentage. The prefix refuses to change once invoices carry it, since that would break a sequence a client has already seen.

WhatsApp templates now written: questionnaire ready, the nudge, agreement ready, the weekly update, invoice issued. Ready for review and day 30 belong to steps 8 and 10.

Verified: 8 end to end tests, on desktop and a phone, 43 in total. A draft is invisible to the client and a sent update has no edit control; the client sees the latest week with the counter and the earlier ones collapsed; the booking button hides itself; the kickoff action moves the phase and then disappears.

Deferred: none.

## Step 6, the WhatsApp sign-off recording path: partial

8 Sep 2026, AI-assisted.

Built: the agreement kind, in full. A block on the project page, shown only while the phase is `agreement_sent`, takes who said it, the day they said it, and the message pasted exactly as they wrote it. It goes through the same `agree()` function as a tap, so the same sign-off event is written, the agreement freezes the same way, and the same advance invoice is raised with the next number. What differs is recorded and never smoothed over: `method` is `whatsapp`, `ip` is null, and `raw_note` holds what they sent. The project page shows the two side by side, one reading "tapped in the portal" and the other "recorded from WhatsApp", with the message underneath.

Verified: 3 end to end tests, on desktop and a phone. The recorded yes raises the same advance for the same amount; a date in the future or before the project existed is refused and writes nothing; the block disappears once the phase moves on, so it cannot be recorded twice. Acceptance criterion 6 now passes for the agreement kind.

Deferred, and why: the delivery kind. PORTAL-SPEC step 6 asks for both, but a delivery sign-off needs a project in `in_review`, which needs the review loop from step 8. Recording one now would mean inventing a phase transition ahead of the step that owns it. The recording action is written so the delivery kind is a second call to the same shape, and step 8 takes it. **Landed in step 8**, as a second action behind the same component with a `kind` prop, exactly as promised.

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
| Some route files and server actions still import `db` directly, against the "no route imports prisma" rule. The agreement, review and project paths go through their modules; the admin project pages and the intake routes still read through `db`. The kickoff write left its route in step 8. | Each area at its next change: intake and files at their next behaviour change, admin project pages in step 11 with the needs-attention block. |
| ~~No phase machine and no `project.phase`.~~ | Done in step 5. |
| ~~No `activity_event`, no dispatcher, no notifications module.~~ | Done in step 5. |
| ~~No serializers module.~~ Note against §2 rule 2: the fields landed in the schema commit and the leak test one commit later, the same afternoon, not in the same commit. | Done in step 5. |
| ~~No `company` table, and no settings screen.~~ Built in step 7, where the booking link first needed somewhere to live. The `setting` key-value table still exists and is still unread; it stays for the first setting that is not a company field. | Done in step 7. |
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
