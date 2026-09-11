# 04. Design decisions

Decided 11 Sep 2026 from `02-friction-log.md` and the before set. Each entry is a decision, not an option. Where a decision was a close call the trade-off is one line. The friction number it answers is in brackets. AI-assisted.

## 1. Principles, in the order they win

1. **One thing to do, and it is visible without scrolling.** CLAUDE.md §2 rule 9 is the whole client design. A long page keeps its reading order and gains a sticky bar that carries the one action to the fold.
2. **The state speaks first.** Every screen opens with where things stand and what, if anything, is wanted. Terminal states (closed, cancelled) say so and ask for nothing.
3. **Delete before adding.** Placeholders that cannot be tapped, prose cards that explain the mechanism, duplicate cards: removed. New UI is added only where the friction log shows a person stuck.
4. **The same idea looks the same everywhere.** Empty, loading, confirm, saved, folded: one primitive each, used by both portals.
5. **Calm motion.** Short, eased, never decorative, and gone under `prefers-reduced-motion`.

## 2. The token layer (extends `src/app/globals.css`; no second system)

- **Colour**: dark only stays; a light theme is new scope and is not built. One token changes: `--faint` goes from #7a7166 (3.9:1 on `--surface`, 3.7:1 on `--ground`, the cause of every contrast failure in the baseline) to #948a7e (4.8:1 on every surface). Ember text already passes (6.3:1 on `--surface`), so no new colour is added. [F-35]
- **Type floor**: nothing a person must read is under 12 px. `.k`, `.tag`, `.help`, `.lbl`, `.mono-sm`, journey labels, table heads move to 11.5 to 12.5 px with letter-spacing eased to 0.08 to 0.12 em. Pure decoration (the "+" on a fold) may stay smaller. Body copy 15/16 px as now. [F-35]
- **Spacing scale**: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 20, `--s-6` 24, `--s-8` 32, `--s-10` 40. Card padding is `--s-5`, stack gaps `--s-3`/`--s-4`, page gutters `--s-5`.
- **Radius**: `--r-1` 2 px (cards, fields, buttons, as now), `--r-2` 6 px (dialog, toast), `--r-pill` 999.
- **Motion**: `--t-fast` 120 ms (hover, focus), `--t-base` 200 ms (folds, toasts), `--t-slow` 320 ms (page skeleton to content, sticky bar). Easing `--ease: cubic-bezier(0.2, 0.7, 0.2, 1)`. A global `@media (prefers-reduced-motion: reduce)` rule sets all of them to 0 ms. [F-36]
- **Elevation**: `--shadow-float: 0 10px 28px rgba(0,0,0,.4)` (menus, toasts, sticky bar).
- **Layers**: `--z-sticky` 30, `--z-menu` 40, `--z-toast` 50, `--z-dialog` 60.
- **Focus**: unchanged, 2 px ember ring, offset 3 px. Every interactive element gets it, including `<summary>` and the nav row.

## 3. Primitives (new folder `src/components/ui/`, CSS in `portal.css` under one "primitives" block)

| Primitive | What it is | Used for |
|---|---|---|
| `Toast` | `role="status"`, bottom centre, one at a time, auto-dismisses in 4 s, pauses on hover. Fed by a one-shot `awtm_flash` cookie that server actions set through `flash(message)` and the shell reads and clears. | every admin action; client actions that stay on the page (saved, sent, code re-sent) [F-30] |
| `NavProgress` | a thin ember line along the top from the tap on a link until the next page lands; a safety timer ends it. Not a `loading.tsx` skeleton: that streams the page, and a `notFound()` thrown after the shell has gone out answers 200, which broke the real 404s of `/thanks` and `/day30` (criteria 10 and 24) | the pause between tap and page [F-01] |
| `Confirm` | a native `<dialog>` wrapping the real form; a title, one line, the dangerous button in ember, "Keep it" as the safe default; optional reason field | rotate link, cancel project, delete a referral, delete an image, lock the questionnaire again [F-24, F-34] |
| `Empty` | a title, one line, an optional action; same measure and tone everywhere | no updates, no invoices, no clients, no images, no notes [F-37] |
| `Fold` | `<details>` with a chevron that rotates, a summary line that can carry a fact ("agreed 11 September"), 44 px hit area | the client's record rows; admin secondary cards [F-17, F-27] |
| `StickyAction` | a bar that appears at the bottom of the viewport while the page's primary control is below the fold (IntersectionObserver), carrying a button that scrolls to and focuses the real control; never a second form | agreement, review, questionnaire [F-05] |
| `Steps` | the journey as five dots and the current label at narrow widths, five labelled steps at 640 px and up; `aria-current="step"` | client home [F-03] |
| `DataList` | a table at 900 px and up; below that each row becomes a card with the first cell as its title and the rest as label/value pairs | admin projects, clients, invoices [F-22] |
| `FilePick` | a styled label around a hidden `<input type=file>`, shows the chosen name | questionnaire upload, image library [F-28] |

Nothing else. No modal system, no component library.

## 4. The client journey, screen by screen

**Shell** (all pages). The wordmark is one line, always: `white-space: nowrap`, 18 px at 390 and 20 px from 960 (item 3). At widths under 560 px the header carries the bell, one "Book a meeting" pill and a round WhatsApp glyph in place of the "Reach us" pill; the glyph opens the same menu. [F-02] The page row gets edge fades when it can scroll and the current page is scrolled into view on load. [F-04] The footer is no longer pinned to the viewport bottom: the page ends after its content with a 34 px gap, at every width. The content measure stays 580/660/700 px. [F-11]

**Way in (`/`).** Primary: "Log in with your email" to `/p/login`. Secondary: the emailed-link explanation and WhatsApp. "Team sign in" stays as a small link. [F-10]

**Code screens.** `send_failed` gets a "Try again" button that re-runs the same start action, and the wording says the email did not go, not that the code was wrong. "Send it again" shows a 30 s countdown after use (client-side only; the server's own limit is untouched). The wrong-code line moves to 12.5 px and sits directly under the field. [F-09, F-15]

**Home.** `pendingTask` returns null for `CANCELLED` and `CLOSED` before it looks at anything else; the day-30 flag no longer outranks the phase. Cancelled: the standing card reads "This project was closed on [date]" with the reason left out (the reason is ours), no journey row, the record below. Closed: the delivered record, read-only, no task (PORTAL-SPEC §6.1 "closed: the record, read-only"). [F-13, D-01] Delivered: one card, "Delivered on [date]", with the thanks ask as its single button until `thanksSeenAt` is set, then the retainer or handover line; the separate "Where things stand: Delivered" card goes. [F-12] Record rows become `Fold`s with a chevron and a fact on the summary line. [F-17]

**Questionnaire.** Locked and waiting states: unanswered questions collapse to one line per section, "6 not answered", instead of a placeholder each; "Tap to add" is only ever shown when a tap does something. The status card at the top carries the "Request a change" control (and its "asked on…" or the reply when declined); the bottom control stays for people who read to the end. Open for changes: a `StickyAction` "Send the changes". Open, first time: a `StickyAction` for the current section's "Save and carry on" / "Finish and send". On a 401 from autosave the renderer says "You were signed out. Your answers are saved. Open your link again to carry on." with a link to the page itself, which shows the code step. [F-05, F-06, F-07, F-08]

**Agreement.** `StickyAction` "I agree" that scrolls to the real button (agreeing still needs the deliberate tap and the code; the bar never submits). Agreed: a one-line stamp under the title, "Agreed by … on …", as well as the block at the end. [F-05, F-19]

**Review.** `StickyAction` "Sign off the delivery", same rule. The two choices keep their order: send back (ghost) above sign off (ember). [F-05]

**Updates.** Grouped by day (Today, Yesterday, then the date). Unread: ember dot and ink title; read: muted. Opening the page marks all read, as now. Only the last 60 show, with a fold for older ones. [F-14]

**Day 30.** A `day30.due` notice (in-portal and email) is written once, lazily, the first time the client's home is rendered after the unlock date; no scheduler exists and none is added. Text: "One month on: two things, under a minute." linking to `/day30`. [F-16]

**Print views.** A "Print or save as PDF" button that calls `window.print()`, hidden on paper. [F-18]

## 5. The admin journey

**Shell.** Under 900 px: a top bar with the wordmark, the nav as a scrollable row and sign out; the inline `flexDirection` that defeated the stylesheet is removed (D-02). Content padding 16 px on phones. [F-21]

**Dashboard.** One `DataList` of projects with: project and client, stage (phase label), waiting on (client, us, nobody), since when, and the next action as a link. "Waiting on" is a pure function of phase and the questionnaire facts (`waitingOn()` in `modules/projects`). The attention block stays above it and loses its mechanism sentence. This is the clients-with-stage table the brief asks for, on the page the team opens first. [F-20, F-33]

**Project page.** Order becomes: the ended banner if any; "Now" (the one thing that moves it on, plus "waiting on" and since when); then the record as `Fold`s, open by default only where the phase makes them live: Agreement (open until agreed), Weekly updates (open while building), Review rounds (open while in review), Invoices (open once one exists and is unpaid), Sign-offs, Day 30 (open once unlocked), Questionnaire, Client. The right column keeps the link card and the sign-off person. "Ending it early" becomes a quiet "Cancel this project" link at the foot that opens a `Confirm` with the required reason; it is absent on ended projects. On a cancelled or closed project every form is gone and the folds are read-only. [F-23, F-24, F-25]

**Client page.** The three explanatory cards fold into one closed `Fold`, "How their link and sign-in work". "Edit client details" becomes a `Fold` whose summary carries the contact name and phone. [F-26, F-27]

**Lists.** Projects and clients use `DataList`. [F-22]

**Questionnaire upload.** `FilePick`, and the "answers exist" checkbox sits above the button it guards. [F-28]

**Decline a change.** Placeholder becomes "Why not, in a line. They read this." [F-29]

**Feedback.** Every action that returns to a page goes through `refreshTo(path, flash)`; the shell renders the toast. Rotate link, delete referral, delete image and cancel go through `Confirm`. [F-30, F-34]

**Login.** One line under the form: "Locked out? The other admin reissues a setup link from Settings." [F-31]

**Image library.** Two columns at 390, four at 900; delete is a ghost button; "in use" is a tag beside the key, not part of the button label. [F-32]

## 6. What is deliberately not done

- No light theme (dark only is a standing decision).
- No questionnaire editing in the portal, in either zone.
- No new phases, no new tables. The day-30 notice is a `ClientNotification` row like the others.
- No client-side data layer; pages stay server rendered.
- No changes to auth, validation or rate limits. The code cooldown is a display of the existing limit.

## 7. Order of work

1. Tokens, motion, primitives (one commit).
2. Client journey: shell, way in, home (with D-01), questionnaire, agreement, review, updates, day-30 notice, print button.
3. Admin journey: shell (D-02), lists, dashboard, project page, client page, upload, confirms, toasts.
4. Backend: `waitingOn()`, `day30.due` notice, `flash()`, terminal-phase guard. Recorded in `05-backend-changes.md`.
5. Tests: unit for `pendingTask` terminal phases, `waitingOn`, `clientNotice("day30.due")`; e2e for both journeys with "Something is off", send back, and the client API cost assertion.
6. Re-walk, after set, `07-before-after.html`, Lighthouse, summary.
