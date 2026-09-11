# 01. Screen inventory, both portals

Every route, who sees it, the job, entry points, exits, and every state it can be in. Written 11 Sep 2026 from the code, then checked in the browser. AI-assisted.

States are named: **loading**, **empty**, **partial**, **error**, **success**, **denied**, **expired**, **done**. A state that exists in code with no UI is marked (no UI); a UI for a state that cannot occur is marked (dead).

Loading: every page is a server component rendered on demand; there is no skeleton anywhere and no client-side data fetching except the questionnaire autosave, so "loading" is a blank navigation with the browser's own progress. Noted once here rather than on every row; it is friction entry F-01.

## Client portal (`/p/[token]/*`, and `/p/me/*` from the session)

| Route | Who | Job | In | Out | States |
|---|---|---|---|---|---|
| `/` | anyone | The way in when someone lands on the bare domain: says this is a private page and how to reach the team | typed URL, search | WhatsApp, email, `/p/login` | success only. (Book a meeting and login link added in this overhaul.) |
| `/p/[token]` signed out | the client, first time on a device | Send a six-digit code, enter it | the emailed link, WhatsApp | signed-in home | start; code sent (masked address); wrong code with tries left; expired code; locked after five; rate limited; mail failed (`send_failed`, says message Rahul); denied: bad token goes to `/p/not-found` |
| `/p/not-found` | anyone with a bad or rotated link | Not a dead end: log in with email or message Rahul | any bad `/p/*` | `/p/login` | success only |
| `/p/login` | a client without their link | Email, then code, then `/p/me` | not-found, way-in | `/p/me` | start; code step (same copy whether or not the email is on file); wrong, expired, locked, rate limited; invalid email |
| `/p/[token]` home | signed-in client | The one thing we need from them, or where things stand, the journey row, the record folded below | link, nav row, every sub-page's wordmark | intake, agreement, review, thanks, day30, invoices, updates | by phase: no project + no intake (nothing needed yet); no project + intake open (task: questionnaire); no project + intake sent (we are on it); INTAKE; AGREEMENT_DRAFT (we are on it); AGREEMENT_SENT (task: read and agree); AGREED (agreed, kickoff soon); BUILDING with no update yet; BUILDING with latest update and earlier weeks folded; IN_REVIEW (task: check the work); DELIVERED with thanks pending; DELIVERED with day 30 due (task); DELIVERED done; CLOSED; CANCELLED (closed on date). Expired session: back to the code screen. |
| `/p/[token]/intake` | client | The questionnaire: one section open at a time, autosave | home task, nav row | home (completion screen has "See your page"), Back a section | open, first section; open, later section (Back shown); required missing on finish (message, opens the section); submitted just now (completion screen); locked (read-only, Request a change visible); asked (waiting on us); changing (tap to edit, Send the changes); declined (reply shown, can ask again); no questionnaire yet: redirect home. Team mode (`/admin/.../fill`) shares the component. |
| `/p/[token]/agreement` | client | Read the one page and agree with a code, or say something is off | home task, nav row | home on agree; stays on push-back | not sent yet: redirect home; sent, not agreed (I agree, code step, Something not right box); agreed (read-only, stamp); code wrong/expired/locked/rate-limited; push-back sent (note recorded, phase back to draft) |
| `/p/[token]/review` | client | Check the finished work against the deliverables, send back or sign off with a code | home task, nav row (only while open) | thanks on sign-off; home | no open round: read-only earlier rounds or redirect; open round (Open the finished work, send back box, sign off); code states; sent back (message) |
| `/p/[token]/thanks` | client, once | Thank you, optional quote and referral | sign-off redirect, delivered card | home | 404 before delivery; form; sent; skipped. (dead: none) |
| `/p/[token]/day30` | client, from day 30 | One number and the approved quote | home task | home | 404 before unlock; form prefilled with the delivery quote; submitted |
| `/p/[token]/invoices` | client | Every invoice, one row each, opens the print view | nav row (only once one exists) | print view | empty ("Nothing yet"); list with paid/unpaid |
| `/p/[token]/updates` | client | Notifications, newest first, unread marked; opening marks read | bell | the linked page | empty; list |
| `/invoice/[id]/print`, `/agreement/[token]/print` | client or team | Paper | invoices list, agreement page, admin | print dialog | success; denied 404 without a session or the right client |

## Admin (`/admin/*`)

| Route | Who | Job | In | Out | States |
|---|---|---|---|---|---|
| `/admin/login` | team | Email and password | typed, any admin route when signed out | `/admin` | form; wrong; account with no password yet ("use your setup link") |
| `/admin/first-run` | the first admin, once | Make the first account with `SETUP_KEY` | DEPLOY.md | `/admin/setup/[token]` | form; no key configured; bad key; rate limited; 404 once anyone can sign in |
| `/admin/setup/[token]` | a new admin, once | Choose a password | setup link | `/admin` | form; too short; mismatch; 404 when used or expired |
| `/admin` | team | Needs attention (silence, asks) and every project | sign-in, sidebar | project, client | attention list empty/with items; projects list empty/with rows. No table of clients with stage and waiting-on: friction F-20. |
| `/admin/clients` | team | Every client | sidebar | client, new | empty; list |
| `/admin/clients/new` | team | Add a client, mint their link | clients list, dashboard | link screen | form; validation error |
| `/admin/clients/[id]/link` | team | The link, shown once, and how to send it | after add, client page | client page | link visible (flash, 15 minutes); link gone (rotate/resend offered); email sent / failed |
| `/admin/clients/[id]` | team | The client: questionnaire state, projects, link, who says yes | clients list, dashboard | intake, upload, project, link | no questionnaire yet (Send it); open (waiting on them); sent and locked; asked to change (Open / Decline); open for changes (WhatsApp line, Lock it again); declined note; projects empty/list; details folded |
| `/admin/clients/[id]/intake` | team | What they told us, versions, changes asked for | client page | fill (unreachable now), upload, JSON | open; sent; `?version=n` reading an earlier version with changed answers marked; hidden keys after a replacement |
| `/admin/clients/[id]/intake/upload` | team | Send or replace the questionnaire JSON | client page | client page | first upload (emails link); replace; every import failure listed at once; answers exist and confirm needed; file too large; not JSON |
| `/admin/clients/[id]/intake/fill` | team | Type answers from a call | no link any more (removed 11 Sep) | intake view | (dead from the UI; kept as a route) |
| `/admin/clients/[id]/projects/new` | team | Start a project on the client's link | client page | project page | form; sign-off person prefilled from the questionnaire |
| `/admin/projects/[id]` | team | The project: agreement, invoices, questionnaire summary, sign-offs, updates, review rounds, day 30, testimonials, referrals, cancel | dashboard, client page | agreement editor, updates, print views | by phase, plus ended banner for CLOSED/CANCELLED; no bank details warning; mark paid; raise an extra invoice; record a WhatsApp sign-off; mark kickoff; mark ready; approve testimonial; forget a referral |
| `/admin/projects/[id]/agreement` | team | Write and send the agreement, internal cost never shown to the client | project page | project page | draft; sent (version n); agreed (frozen); intake gate with override; client notes listed |
| `/admin/projects/[id]/updates` | team | Weekly updates | project page | project page | none; draft; sent |
| `/admin/library` | team | Pictures for image_choice questions | sidebar | upload | empty; list; delete refused when in use |
| `/admin/settings` | team | Company details, bank details, booking link; the two admin seats | sidebar | | saved flag; invite link shown once; both seats taken; remove an unused seat |

## States in code with no UI, and UI for states that cannot occur

- Client session expiry mid-questionnaire: the autosave returns 401 and the page shows "Could not save. Check the connection." (no UI that says sign in again): F-06.
- `send_failed` on a sign-off code: the message tells them to message Rahul; there is no retry control: F-09.
- Admin `/intake/fill`: reachable only by URL now (dead from the UI). Kept because the renderer's team mode is tested; noted in the summary as a candidate to remove.
- `/admin/first-run` renders a form when `SETUP_KEY` is unset, which can never succeed: (dead) until the key exists; it says so.
- The day-30 page has no notification event, so a client is not told when it opens: F-16.
