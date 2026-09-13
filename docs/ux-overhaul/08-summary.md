# 08. Summary

The UX overhaul of awtmforge.com, run end to end on 11 Sep 2026 on the branch `ux-overhaul` (six commits on top of `main` at 976e592, not pushed, not deployed). AI-assisted; the judgement in the specs is Rahul's and Ayush's. Dates are 2026.

## What was done

Both journeys were walked and photographed at 390, 768 and 1440 px in every reachable state (168 frames), the friction was written down as F-01 to F-37, each item was decided in `04-design-decisions.md`, and the decisions were built: a token layer for spacing, motion and layers on top of the existing colours; a 12 px reading floor; one contrast fix; eight primitives shared by both portals; the client journey re-paced around one action in reach and honest end states; the admin journey re-paced around who each project is waiting on, folds that open by phase, confirms for the five irreversible moves and a toast after every action. Both journeys were walked again and photographed; `07-before-after.html` puts every frame beside its earlier self.

All 37 friction entries were addressed. Nothing in PORTAL-SPEC §2 was built, no phase, table or route was added, and auth, validation and rate limits are untouched.

## The numbers

Lighthouse, same profile and screens as `03-baseline-metrics.md` (mobile for the client, desktop for the team):

| Screen | Perf before | Perf after | A11y before | A11y after | Best practices before | after | LCP before | LCP after |
|---|---|---|---|---|---|---|---|---|
| way in | 85 | 96 | 95 | 100 | 100 | 100 | 4.4 s | 2.8 s |
| client login | 85 | 96 | 95 | 100 | 96 | 100 | 4.4 s | 2.8 s |
| client code step | 86 | 96 | 95 | 100 | 96 | 100 | 4.2 s | 2.8 s |
| client home | 83 | 96 | 96 | 100 | 100 | 100 | 4.7 s | 2.8 s |
| client agreement | 87 | 96 | 88 | 100 | 100 | 100 | 4.1 s | 2.8 s |
| client questionnaire | 86 | 96 | 96 | 100 | 100 | 100 | 4.2 s | 2.8 s |
| client invoices | 86 | 96 | 95 | 100 | 96 | 100 | 4.2 s | 2.8 s |
| admin login | 100 | 100 | 95 | 100 | 100 | 100 | 0.8 s | 0.5 s |
| admin dashboard | 100 | 100 | 95 | 100 | 100 | 100 | 0.8 s | 0.5 s |
| admin project | 99 | 100 | 95 | 100 | 100 | 100 | 0.9 s | 0.6 s |
| admin client | 100 | 100 | 95 | 100 | 100 | 100 | 0.8 s | 0.5 s |
| admin agreement editor | 100 | 100 | 95 | 100 | 100 | 100 | 0.8 s | 0.6 s |

Accessibility is 100 on every screen (the brief's floor was 95); no contrast, definition-list or legibility failures remain; CLS stays 0 everywhere, sticky bar and toasts included; best practices 100 everywhere (the 96s were the legibility audit on 11 px captions, which is why the floor is 12 px and not 11.5). Client LCP on the throttled mobile profile fell from 4.1 to 4.7 s to 2.8 s, almost all of it from 220 KB of font leaving the critical path; the 2.5 s target in `03` was not reached, and what remains is the simulated slow-4G download of the RSC payload and the three remaining font files, which a font subset or `font-display: optional` could each shave. Not done here: each changes how the brand type first appears, which is a taste decision for Rahul.

Tests: 178 unit tests (28 files, three new: `journey`, `waiting`, and the month-on notice in `client-notice`) and 169 end-to-end tests on desktop Chrome and Pixel 7 (3 skipped by design: the phone-only checks on desktop and one desktop-only), all green on the final build; `tsc --noEmit` and `eslint` clean. `tests/e2e/overhaul.spec.ts` pins the decisions that are easiest to undo by accident, and the leak walk now reads every client route and the questionnaire JSON API as raw response bodies and asserts that the seeded internal cost and internal notes are absent (criterion 8 at the API layer, not the template).

## Defects found, and what happened to them

`09-found-defects.md` has the detail. Two product defects fixed (D-01, the cancelled project that still asked for the month-on check-in; D-02, the admin nav that never became a row on a phone). Four end-to-end tests on `main` were red before this branch because the 11 Sep redesign had moved their copy (D-04); they test the current words now. Two branch-only mistakes were caught by the suite and the re-walk before merge (D-05, a `loading.tsx` that turned real 404s into 200s; D-06, a class name collision that stacked the dashboard table). One environment note (D-03) explains a wedged audit server so nobody chases it again.

## What is deliberately not in this branch

No light theme, no questionnaire editing in the portal, no scheduler (the day-30 notice is lazy by decision, ADR 0019), no new tables or phases, no changes to auth or limits, no marketing site changes. `admin/clients/[id]/intake/fill` is still reachable by URL only; removing it is a one-line change once Rahul confirms nobody types answers from a call any more.

## How to review

1. Open `docs/ux-overhaul/07-before-after.html` from the repo (the frames are relative links). The 390 px tab is the one that matters most.
2. Read `04-design-decisions.md` for the why, `06-decision-log.md` for the calls made on the way.
3. Run it: `docker compose up -d`, `npm run build`, `MAIL_TRANSPORT=log APP_URL=http://127.0.0.1:3210 npx next start --port 3210`, then `npm run db:seed` if the database is fresh; the seed client's link is minted by `npx tsx scripts/dev-link.ts`.
4. `npm test` and `npx playwright test` against that server.

## Merging

The branch merges onto `main` cleanly (it is six commits ahead, nothing behind). Auto-deploy fires on push to `main`, about two and a half minutes to live, and `/healthz` reports the commit. Nothing in the branch needs a migration or a new environment variable. The one thing to look at on the live site first is the client home on a phone in each phase, because that is the page every client sees most.

---

# The client home page, rebuilt 13 September 2026

A second pass, on the same branch, after an audit of the live home page at
1440 px. The earlier overhaul re-paced the page; this one changed what it
leads with. AI-assisted. Dates are 2026.

## What was wrong, and what it is now

**The hierarchy was inverted.** The largest words on the page were the project
name, which the client already knows. Whether anything was needed from them sat
under it in a low-contrast box in smaller type. The status is the hero now and
carries the largest type on the page; the project name is one size step under
it, with a meta line giving the day it started and the day it last moved, both
absolute and both with the weekday.

**Four type voices argued.** Uppercase monospace labels, a sans for headings, a
serif for body copy and monospace again for the footer, with long footer
sentences set in mono at low contrast. Two voices now: the sans carries every
heading, label and sentence, and the mono is for short metadata only, a date or
a week number. No full sentence is set in monospace anywhere in the portal.

**The header carried three things that did nothing.** Browser-style chevrons
inside a portal with four pages, a bell with no count and nothing behind it,
and two outlined orange buttons of equal weight competing. It is now the
wordmark, the pages this client actually has as plain text links, and one
filled button. The bell appears only when there is a list to open, and then it
carries a count. Under 900 px the links fold into the menu and the button
stays.

**The stage rail could not be read as progress.** Five hollow circles joined by
dashes, all the same grey but one, in uppercase monospace, ending in a stage
called "A month on". Three states now, told apart by shape before colour: done
is a filled disc with a tick, current is a ring with a filled centre and a
heavier label, upcoming is a hollow ring. The line fills to where they are.
Every stage is a button that opens one sentence about what happens in it and
how long it takes; tapping the one they are on scrolls to the status instead.
On a phone the rail is vertical and the sentence opens under the stage tapped.
The last stage is called Check-in. Its identifier is still `month`, because
nothing was gained by renaming a key that the database already speaks.

**The status card said nothing about time.** It now carries a chip that is one
of exactly three, the headline, one or two sentences, and then either an
expected date and the channel we will message on, or one button that names the
action. The accent edge appears only when something is needed. Every date is a
fact set by hand in admin: where there is none, the line is dropped rather than
invented, and a date that has passed is dropped too.

**"How this works" was folded by default,** so a first-time client saw nothing
about the journey. It is open until the questionnaire is behind them, folded
after that, and their own choice from then on, remembered per client on their
device. It reads the same five notes the rail opens, so the two cannot drift.

**The page had no floor.** It ended around 640 px and left a dark void. The
frame is a flex column the height of the window with the footer last.

**Contrast was low across the board, and there was only one theme.** The two
greys became one, brighter one. There are two themes now, dark by default in
both portals and light one button away on the bar beside the menu, in the team
zone as well as the client one. The palette is checked by a script rather than
by eye.

## The numbers

Lighthouse, the same profile and screens as `03-baseline-metrics.md`, against a
production build. Every screen: accessibility 100, best practices 100, no
failing audits, in both themes. Performance and largest paint match the page
this replaces to within noise.

| Screen | Perf before | Perf after | LCP before | LCP after |
|---|---|---|---|---|
| client home, mobile | 96 | 96 | 2769 ms | 2768 ms |
| client home, light, mobile | not measured | 96 | | 2769 ms |
| client home, desktop | not measured | 100 | | 585 ms |
| client agreement | 96 | 96 | 2768 ms | 2766 ms |
| client questionnaire | 96 | 96 | 2769 ms | 2765 ms |
| client invoices | 96 | 96 | 2768 ms | 2768 ms |

Getting there cost one decision. The brief asked for a 200 ms fade and rise on
entry, and also for no performance regression. Measured both ways, the fade
costs 400 ms of largest contentful paint and 90 ms of blocking time, because
the browser will not count text it cannot see yet. The page rises without
fading: the entrance is there and the measurement is not.

Tests: 197 unit tests in 30 files and 191 end-to-end tests on desktop Chrome
and Pixel 7, 3 skipped by design, all green. `tsc --noEmit` and `eslint` clean.
The palette check is `tests/contrast.test.ts`, 38 pairings in both themes. The
five-stage walk is `tests/e2e/client-home.spec.ts`, which drives the admin side
and asserts the chip, the headline and the button at each step.

## The screenshots

`docs/ux-overhaul/audit/client-home/` holds 102 pictures: seventeen states at
390, 768 and 1440 px, in dark and light. Open `index.html` from that folder for
the contact sheet, which lays them out in one scroll. They are made by
`scripts/ux-audit/client-home.ts`, which drives the real database into each
state and puts it back afterwards.

Four of the twenty state combinations asked for are the same instant in this
system and are written once: a submitted questionnaire and an agreement being
prepared are one moment, and so are a delivery being prepared and a delivery
sent back. A test walks every fact combination and fails if any state in the
copy file is unreachable. The build's "paused with a reason" is written as
closed early, because this system has no pause and calling it one would promise
a restart nothing can deliver. All three are in `06-decision-log.md`.

## Deploying it

One migration, `20260913193000_project_expected_by`, adding two nullable
columns to `Project`. It is additive and reversible, and both columns are null
on every existing row.

1. Merge to `main`. Hostinger builds on push; about two and a half minutes.
2. `prisma migrate deploy` runs in the build, through
   `scripts/migrate-if-configured.mjs`. Nothing to run by hand.
3. No new environment variable. The theme is a cookie the browser sets.
4. `/healthz` reports the commit when it is live.

## Five minutes on the live site

1. Open a client link on a phone. The status card is the biggest thing on the
   page and says whether anything is needed from you. The rail above it is
   vertical, with one stage marked as where you are.
2. Tap a stage you have not reached. One sentence opens under it saying what
   happens and roughly how long it takes. Tap the stage you are on: the page
   scrolls to the status card.
3. Press the sun beside the menu. The page turns to paper without reloading.
   Reload it: still light. Press the moon and it goes back. The same switch is
   at the top of the admin sidebar.
4. On a laptop, the pages are plain text links on the bar with the current one
   underlined, and one filled button. There are no back and forward chevrons.
   The footer sits at the bottom of the window, not halfway up it.
5. In admin, open a project and set "What their page says to expect" to a date
   a few days out. Reload the client page: it now reads "We expect to have it
   with you by" that date, with the weekday. Move the project on a stage and
   the date clears itself, because it belonged to the stage that ended.
