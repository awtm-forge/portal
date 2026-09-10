# Routes

Every route with its zone, who may reach it, what it accepts and which
acceptance criteria cover it. Written from the code in the step that adds each
route; last checked against the code on 10 September 2026, after the questionnaire moved to the client.

Zones and their rules are in `ARCHITECTURE.md`. This host is entirely private
(ADR 0012): every route sends `X-Robots-Tag: noindex, nofollow`,
`Cache-Control: no-store` and `Referrer-Policy: no-referrer` through
`src/proxy.ts`, and `robots.txt` is a single `Disallow: /` (criteria 18, 19).

The client portal and the team admin answer on two hostnames from one app
(ADR 0013). `src/proxy.ts` refuses `/admin` on the client host and `/p/` on
the team host with a 404, and sends the bare team host to `/admin`. When
`ADMIN_URL` is unset the two run on one hostname and nothing is refused.

## The way in, and the host itself

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/` | GET | none | Says the project page opens from the emailed link and offers a quiet team sign-in. Reads nothing, so it renders with the database stopped. On the team host it redirects to `/admin`. |
| `/robots.txt` | GET | none | `Disallow: /`. Generated from `src/app/robots.ts`. |
| `/healthz` | GET | none | `{"status":"ok","commit","claimed","mail","mailVars"}` when the database answers, 503 and `degraded` when it does not. `commit` is the short hash of the running build, `claimed` whether anyone can sign in, `mail` one of `smtp`, `log`, `none`, and `mailVars` which of the six mail variables the process sees, by name only: set, empty, missing, and any key with SMTP in it that is not one of them. `links` is the two hostnames the app builds links from (`client` from APP_URL, `admin` from ADMIN_URL or its fallback), by hostname only, so a link pointing at a host with no DNS is visible from outside. `admins` is `{rows, activated}`, counts only: how many admin rows exist and how many can sign in, so a full-seats invite refusal can be told from a bad input without touching the database. No values and no error text: it is reachable without signing in, so the failure detail goes to the log. |
| `/api/enquiry` | POST | none, same origin only | `{name, business, problem, budget, adSpend, contact}` as JSON. Rate limited to five an hour per IP. Writes `enquiry` and emits `enquiry.received`, which emails the team. Answers 503 rather than pretending when the database is down. Nothing posts to it while the marketing site is unrouted; it is kept for when the site returns on its own host. |

## Client portal, dynamic, unindexed

Reached by the project link. The token is 32 random bytes, stored only as a
hash (ADR 0003). A project that does not exist and a wrong token are both 404.

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/p/[token]` | GET | link; a session shows the project | The one page whose content follows `project.phase`. Without a session it is the code screen. While building it carries the current week in full, the week counter, and the Book a sync button when a booking link is set. |
| `/p/[token]` (code) | server action | link | Requesting a `login` code, then verifying it. Ten minutes, five attempts, single use, then a thirty-day cookie (criterion 5). |
| `/p/[token]/intake` | GET | link and session | The questionnaire, one section at a time. |
| `/p/[token]/invoices` | GET | link and session | Every invoice on the project, each opening its printable page (Q15). |
| `/p/[token]/intake/api/[action]` | POST | link and session, same origin | `save`, `access`, `section-done`, `submit`, `upload`, `remove-file`, `ask-change`. The first `submit` moves a waiting project to `agreement_draft`, notifies the team and writes version 1. After that every write but `access` answers 409 until the team opens it; `ask-change` takes one line; `submit` then sends the changes as the next version and locks again (ADR 0016). |
| `/p/[token]/file/[fileId]` | GET | link and session | An uploaded file, or its thumbnail with `?thumb`. 404 for a file on another project (INTAKE-SPEC 14.6). |
| `/p/[token]/lib/[key]` | GET | link and session | An image library picture, for `image_choice`. |
| `/p/[token]/agreement` | GET | link and session | The agreement once it has been sent. Frozen and stamped after sign-off. |
| `/p/[token]/agreement` (agree) | server action | link, session, and a fresh `agreement` code | Writes `signoff_event`, freezes the agreement, raises the advance invoice, all in one transaction (criteria 1, 5, 6, 7). |
| `/p/[token]/agreement` (push back) | server action | link and session, no code | Writes an append-only `agreement_note` and returns the phase to `agreement_draft` (criterion 23). |
| `/p/[token]/review` | GET | link and session | The deliverables with their how-to-check lines, the link to the finished work, and earlier rounds collapsed. |
| `/p/[token]/review` (changes) | server action | link and session, no code | Writes the note on the open round and returns the phase to `building`. Creates no invoice (criterion 2). |
| `/p/[token]/review` (sign off) | server action | link, session, and a fresh `delivery` code | One transaction: `signoff_event` kind delivery, round accepted, `delivered_at`, the balance invoice, the day-30 row. Redirects once to `/thanks` (criteria 2, 5, 6). |
| `/p/[token]/thanks` | GET, server action | link and session | 404 before the delivery sign-off, renders after (criterion 24). Two optional fields and Send, plus Skip; both record that they saw it. |
| `/p/[token]/day30` | GET, server action | the project's link and session | 404 before `day30.unlocks_at`, renders after it. The unlock is a comparison made on read, so nothing is scheduled and nothing can fail to fire (criterion 10). The metric line from the project, one field, the quote prefilled from the delivery draft, two permission switches, one button. Both fields optional. Answering approves the quote, records the number, and cannot happen twice. First view stamps `opened_at`. |

## Printable, dynamic, unindexed

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/agreement/[token]/print` | GET | the project's link and session, or an admin session | The path segment is a link token; an admin may pass a project id instead, since admin never holds a token. Renders the print view, which has no field for internal cost (criteria 8, 15). |
| `/invoice/[id]/print` | GET | an admin session, or a client session for that invoice's project | Company block, client block, number and date, the line naming the project, the total in figures and in words, bank details, and the GST block only once `company.gstin` is set (PORTAL-SPEC 5.8, 6.7). Sessions are cookied per project, so a client signed in elsewhere gets a 404, not someone else's invoice. Takes print views only, so internal cost has no way onto the page (criteria 8, 12). |

## Team admin, dynamic, unindexed

No self-registration. Two accounts, created by `npm run admin:create`, which
prints a one-time setup link and never a password.

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/admin/login` | GET, server action | none | Rate limited to ten attempts in fifteen minutes per IP. An account with no password yet cannot be signed into. |
| `/admin/setup/[token]` | GET, server action | a valid, unused setup link | The person chooses their own password, at least twelve characters, and is signed in. The link works once and expires in 48 hours. |
| `/admin` | GET | admin | Projects, with the questionnaire state of each, under a needs-attention block computed on read (PORTAL-SPEC 6.6). |
| `/admin/clients` | GET | admin | Every client, who we talk to, their projects, and whether each link has gone out. |
| `/admin/clients/new` | GET, server action | admin | Adds a client on its own. Sends nothing. Can continue straight into a project. |
| `/admin/clients/[id]` | GET, server action | admin | The client record, their projects, and their contact details, edited here rather than on a project. |
| `/admin/clients/[id]/projects/new` | GET, server action | admin | Starts a project on the client's existing link (ADR 0015). It mints nothing. The sign-off person is asked here, offered first from what the client named on the questionnaire. If the questionnaire is already in, the project starts past the gate. If the link never went out, this sends it (criterion 22). |
| `/admin/clients/[id]/link` | GET, server action | admin | The handover, reached the moment a client is saved. Shows the link in the clear while a fifteen minute cookie holds it, the WhatsApp message ready to send, and the email's state with a retry. Once that cookie is gone the link cannot be shown again, because only its hash is stored; rotating makes a new one. The email goes when the questionnaire is sent, or when the first project starts, whichever comes first. |
| `/admin/projects/[id]` | GET | admin | Phase, the agreement, invoices, sign-offs, the client link and its email status, the questionnaire, and the sign-off email confirmation. |
| `/admin/projects/[id]/agreement` | GET, server action | admin | The editor, with internal cost and notes in a block marked never shown to the client. Saving, sending, and the questionnaire override. |
| `/admin/projects/[id]` (record WhatsApp) | server action | admin | PORTAL-SPEC 5.11, both kinds. Records a yes that arrived on WhatsApp: the same sign-off event and the same invoice, `method=whatsapp`, no ip, the pasted message kept. Offered while the phase is `agreement_sent` for the agreement, `in_review` for the delivery. |
| `/admin/projects/[id]` (mark ready) | server action | admin | Opens a review round. The link to the finished work is required. Offered only while the phase is `building` and the agreement is agreed. |
| `/admin/projects/[id]` (forget a referral) | server action | admin | The one delete in the system. Removes the row and writes a `referral.forgotten` event, so the fact survives without the details. |
| `/admin/clients/[id]/intake` | GET | admin | What they told us, with `entered_by` per answer, the versions, and the changes asked for. `?version=n` reads an earlier version as it was sent, with the answers that changed marked (ADR 0016). |
| `/admin/clients/[id]` (server actions) | POST | admin | Open a sent questionnaire for a change, answering the client's ask or unasked; decline the ask with the line they read; lock it again as the next version (ADR 0016). |
| `/admin/clients/[id]/intake/upload` | GET, server action | admin | "Send the questionnaire" (Q12). Import or replace the document on the client. The first time, it also emails the client their link. Every failing rule is reported at once and nothing is saved (INTAKE-SPEC 14.2, 14.3). |
| `/admin/clients/[id]/intake/fill` | GET | admin | Typing answers from a call; each is marked `entered_by: team`. |
| `/admin/clients/[id]/intake/api/[action]` | POST | admin, same origin | The same actions as the client's, except `submit`, which only the client does. |
| `/admin/clients/[id]/intake/answers.json` | GET | admin | The answers document (INTAKE-SPEC 6), with `answers_version`. `?version=n` for the answers as they were sent then. |
| `/admin/clients/[id]/file/[fileId]` | GET | admin | An uploaded file or its thumbnail. |
| `/admin/lib/[key]` | GET | admin | An image library picture. |
| `/admin/library` | GET, server action | admin | Upload, replace, delete. A key named by any uploaded questionnaire cannot be deleted. |
| `/admin/settings` | GET, server action | admin | Our own details: company, bank, invoice prefix, GSTIN, booking URL, default advance percentage. The prefix refuses to change once invoices carry it. Nothing here belongs to a client. |
| `/admin/projects/[id]/updates` | GET, server action | admin | The weekly update. A draft until sent, frozen after. `?week=N` opens a particular week. The WhatsApp message is built from the same fields. |
| `/admin/projects/[id]` (mark kickoff) | server action | admin | PORTAL-SPEC 5.2, `agreed` to `building`. Offered only while the phase is `agreed`. |
| `/admin/projects/[id]` (friction notes) | server action | admin | ADMIN ONLY in the schema, and no client view has a field for it. |
| `/admin/projects/[id]` (approve a testimonial) | server action | admin | For a quote they approved on WhatsApp. Records `approved_method = whatsapp`, so a tap and a message never become indistinguishable (PORTAL-SPEC 5.11). |
| `/admin/projects/[id]` (cancel) | server action | admin | CLAUDE.md 5. Any phase except delivered, closed and cancelled. The reason is required. Creates no invoice and changes no issued one. |
| `/admin/projects/[id]` (close) | server action | admin | PORTAL-SPEC 5.2, `delivered` to `closed`, by hand. The record stays readable at the same link. |
| `/admin/projects/[id]` (mark paid) | server action | admin | The only thing that moves on an issued invoice, and the guard in `lib/db` allows only the four payment fields. The date must read, must not be in the future, and must not be before the invoice was raised. Conditional on the invoice still being issued, so two admins at once record one payment (criterion 16). |
| `/admin/projects/[id]` (raise an extra) | server action | admin | `kind=other` only, and the only invoice an admin can raise by hand. The advance and the balance follow a sign-off and nothing else: no route reaches `issueAdvance` or `issueBalance` (criterion 3). |

## Not built yet

Nothing. Steps 1 to 11 of PORTAL-SPEC section 9 are built; step 12 is the deploy. See `BUILD-LOG.md`.
