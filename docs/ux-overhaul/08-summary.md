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
