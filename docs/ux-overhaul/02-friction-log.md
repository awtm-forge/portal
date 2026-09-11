# 02. Friction log, both journeys

Walked on 11 Sep 2026 against a local production build (port 3210, local database, log mailer) with Playwright at 390, 768 and 1440 px, then by hand in the browser. Every screen in every reachable state is in `audit/before/` as `<screen>--<width>.png` (166 frames; the questionnaire frames at 1440 were reshot separately). The app is dark only, so there is one theme. AI-assisted.

Numbering is stable: `01-screen-inventory.md` already cites F-01, F-06, F-09, F-16 and F-20, and `04-design-decisions.md` decides each one by number.

Severity: **high** blocks or misleads the person on the job they came for; **medium** slows them or makes them doubt the product; **low** is polish.

## The client, from the emailed link to the day-30 page

| # | Screen and state | What the person is trying to do | What gets in the way | Sev | Evidence |
|---|---|---|---|---|---|
| F-01 | every page | move between pages | there is no loading state anywhere, so every tap is a blank pause on a phone connection; nothing says the tap registered | medium | inventory; any navigation |
| F-02 | every signed-in page at 390 | read where they are | the wordmark wraps to two lines ("awtm" over "forge") because the bell and two pills crowd it; the header looks broken on every page | high | `client-21-home-agreement-sent--390`, `client-25`, `client-27` |
| F-03 | home at 390 | see what comes next | the five-step journey row wraps, leaving "A month on" alone on a second line | medium | `client-21`, `client-25`, `client-26` |
| F-04 | home, review, agreement at 390 | go to another of their pages | the page row overflows sideways with no fade and no sign it scrolls; "Invoices" is cut to "Invo" once Review exists | high | `client-26-home-review--390`, `client-27-review--390` |
| F-05 | agreement (2,300 px), review (1,400 px), questionnaire open for changes (4,500 px) | do the one thing asked | the primary action sits at the very bottom; at 375 px nothing actionable is above the fold, which breaks CLAUDE.md §2 rule 9 | high | `client-22-agreement-to-agree--390`, `client-27`, `client-36` |
| F-06 | questionnaire, session expired | keep answering | autosave fails with "Could not save. Check the connection." although the connection is fine; there is no way back in from the page | medium | code: `IntakeRenderer.tsx` save path, inventory |
| F-07 | questionnaire, locked or waiting | reread what they sent | every unanswered question shows a placeholder "Not answered. Tap to add." although nothing can be tapped; 19 placeholders push the page to 4,700 px | high | `client-34-questionnaire-locked--390`, `client-35` |
| F-08 | questionnaire, locked | ask for a change | "Request a change" is the last thing on that 4,700 px page; the status line at the top does not offer it | high | `client-34` |
| F-09 | code step, mail failed | get in, or sign off | `send_failed` says to message Rahul and offers no retry, although the failure is usually transient | medium | code: `CodeScreen.tsx`, `AgreeControls.tsx`, `ReviewControls.tsx` |
| F-10 | `/` (the bare domain) | get to their page without the email | the page offers "Team sign in" and WhatsApp only; the client login that exists at `/p/login` is not linked | high | `client-00-way-in--390` |
| F-11 | code screen, login, invoices, early-phase home; worse at 1440 | read a short page | the shell pins the footer to the viewport bottom, so 300 to 500 px of nothing sits between content and footer at 390, and half the screen at 1440 | medium | `client-04-code-start--390`, `client-32-invoices--390`, `client-25-home-building--1440` |
| F-12 | home, delivered, thanks not yet seen | say how it went | two cards both say "Delivered"; the ask is a ghost button inside the second card, and the standing card above it says nothing new | medium | `client-29-home-delivered--390` |
| F-13 | home, project cancelled or closed | understand that it ended | a cancelled project still shows "What we need from you: a quick month-on check-in" and no "closed on [date]" line; the journey row and the closed message from PORTAL-SPEC §6.1 are missing. Defect, listed again in `09-found-defects.md` | high | `client-38-home-cancelled--390`, `client-37-home-closed--390` |
| F-14 | updates | see what is new | every notification ever, one flat list with no day grouping, unread barely distinguishable, no end; after a month it is a wall | medium | `client-33-updates-empty--390` (not empty on the seed) |
| F-15 | code step | type the code | the wrong-code message is 10.5 px mono under the field; "Send it again" has no cooldown hint, so a second tap looks ignored | low | `client-06-code-wrong--390` |
| F-16 | day 30 | come back a month later | nothing tells the client the page has opened; the only prompt is if they happen to open the link | medium | inventory; no `day30.opened` notice |
| F-17 | home | open the record | "What you told us +", "Your invoice +" are mono captions; the "+" is the only sign they open, and nothing changes on hover or focus | low | `client-25-home-building--390` |
| F-18 | invoice and agreement print views on a phone | save the PDF | the copy says "Print this page" but the print control is in the browser's share sheet; no button on the page | low | `client-39-invoice-print--390` |
| F-19 | agreement, agreed | check it is settled | the "Agreed by … on …" stamp is the last block of a 2,000 px page; the top still reads like a page waiting to be agreed | low | `client-24-agreement-agreed--390` |

## The team, from sign-in to closing a project

| # | Screen and state | What the person is trying to do | What gets in the way | Sev | Evidence |
|---|---|---|---|---|---|
| F-20 | dashboard | see every client with stage and who is waiting on whom | the projects table has questionnaire state only; there is no client list with stage and "waiting on" | medium | `admin-02-dashboard--1440` |
| F-21 | every admin page at 390 | do anything on a phone | the sidebar becomes a two-column header 180 px tall: a vertical nav list next to the wordmark, "Signed in / Audit / Sign out" crushed at the right | high | `admin-02-dashboard--390`, `admin-05` |
| F-22 | projects and clients lists at 390 | find a client | five-column tables wrap word by word; rows are 100 px tall and the last column is cut off | high | `admin-02-dashboard--390`, `admin-03-clients--390` |
| F-23 | project page | see what to do next | eleven cards in one stack (3,900 px at 390, 2,670 px at 1440 with an almost empty right column); the day-30 notes, cancel and sign-off-person forms are always expanded; only the ember card hints at the next action | high | `admin-20-project-building--390`, `admin-20-project-building--1440` |
| F-24 | project page, any phase | (not cancel) | "Ending it early" shows a reason box and a "Cancel it" button on every project all the time; the one irreversible action is the most permanent form on the page | medium | `admin-20-project-building--1440` |
| F-25 | project page, cancelled or closed | read the record | every editing form is still live: day-30 notes, replace the questionnaire, change who signs off, raise an invoice | medium | `admin-21-project-cancelled--390` |
| F-26 | client page, add a client, link page | act on the client | explanatory prose cards ("How they get in", "Who says yes", "Their link", "What this screen does not do") take more room than the data, and repeat on every client | medium | `admin-05-client-questionnaire-open--1440`, `admin-04-client-new--390`, `admin-08-client-link--390` |
| F-27 | client page | edit the client | "Edit client details" is a bare caption in a box; no disclosure mark, no hint it opens | low | `admin-05-client-questionnaire-open--390` |
| F-28 | questionnaire upload | replace the document | a raw browser file input ("Choose File No file chosen") under the styled button; the "answers exist, I understand" checkbox comes after the submit button it guards | medium | `admin-07-intake-upload--390` |
| F-29 | client page, change asked | decline a change | the decline field's placeholder "Or the line they read if not" is cryptic | low | `admin-10-client-asked--390` |
| F-30 | every admin action | know it worked | mark paid, save notes, save settings, record a sign-off: the page simply re-renders; no toast, no "saved at" except on settings | medium | code: action files return to `refreshTo(path)` |
| F-31 | admin login | get back in after a lost password | the page does not say that the other admin reissues a setup link from Settings | low | `admin-00-login--390` |
| F-32 | image library at 390 | pick or delete an image | one image per row, each a 300 px square, 3,000 px total; "Delete, in use" reads like a state, not a control | low | `admin-30-library--390` |
| F-33 | dashboard | glance | "Worked out when this page loads, from dates that are already there…" explains the mechanism, not the list | low | `admin-02-dashboard--1440` |
| F-34 | rotate the link, delete a referral, delete an image, cancel | do something irreversible | none of these confirms; one tap or one text box and a button | medium | `admin-08-client-link--390`, code: `day30` referral delete, library delete |

## Cross-cutting

| # | Where | What gets in the way | Sev |
|---|---|---|---|
| F-35 | both portals | mono uppercase captions at 10.5 px (kickers, journey labels, table heads, help lines) sit under a readable floor; Lighthouse and a phone in sunlight both object | medium |
| F-36 | both portals | there is no motion vocabulary: folds snap open, pages swap with no transition, buttons have no pressed state; the product feels abrupt rather than calm | low |
| F-37 | both portals | no shared primitives: every empty state, confirm and status line is hand-written in place, so the same idea looks different on different pages (compare "None yet" on updates with "Nothing yet" on invoices) | low |

## What is fine and stays

The one-task home card and its copy. The code step's plain explanation. The agreement's structure (what, deliverables with how-to-check, not included, dates, price, then agree). The review page's two honest choices. The thank-you page. The day-30 page. The admin client page's questionnaire card and its four states. The ember accent and the dark palette. None of these are rebuilt; they are laid out and paced better.
