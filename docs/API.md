# Routes

Every route with its zone, who may reach it, what it accepts and which
acceptance criteria cover it. Written from the code in the step that adds each
route; last checked against the code on 8 September 2026.

Zones and their rules are in `ARCHITECTURE.md`. Everything outside the
marketing zone sends `X-Robots-Tag: noindex, nofollow`, `Cache-Control:
no-store` and `Referrer-Policy: no-referrer` through `src/proxy.ts`, and is
disallowed in `robots.txt` (criteria 18 and 19).

## Marketing, static, indexed

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/` | GET | none | Statically generated, never reads the database (criterion 17). |
| `/robots.txt` | GET | none | Generated from `src/app/robots.ts`. |
| `/api/enquiry` | POST | none, same origin only | `{name, business, problem, budget, adSpend, contact}` as JSON. Rate limited to five an hour per IP. Writes `enquiry` and emits `enquiry.received`, which emails the team. Answers 503 rather than pretending when the database is down. |

## Client portal, dynamic, unindexed

Reached by the project link. The token is 32 random bytes, stored only as a
hash (ADR 0003). A project that does not exist and a wrong token are both 404.

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/p/[token]` | GET | link; a session shows the project | The one page whose content follows `project.phase`. Without a session it is the code screen. |
| `/p/[token]` (code) | server action | link | Requesting a `login` code, then verifying it. Ten minutes, five attempts, single use, then a thirty-day cookie (criterion 5). |
| `/p/[token]/intake` | GET | link and session | The questionnaire, one section at a time. |
| `/p/[token]/intake/api/[action]` | POST | link and session, same origin | `save`, `access`, `section-done`, `submit`, `upload`, `remove-file`. Submitting moves the phase to `agreement_draft` and notifies the team. |
| `/p/[token]/file/[fileId]` | GET | link and session | An uploaded file, or its thumbnail with `?thumb`. 404 for a file on another project (INTAKE-SPEC 14.6). |
| `/p/[token]/lib/[key]` | GET | link and session | An image library picture, for `image_choice`. |
| `/p/[token]/agreement` | GET | link and session | The agreement once it has been sent. Frozen and stamped after sign-off. |
| `/p/[token]/agreement` (agree) | server action | link, session, and a fresh `agreement` code | Writes `signoff_event`, freezes the agreement, raises the advance invoice, all in one transaction (criteria 1, 5, 6, 7). |
| `/p/[token]/agreement` (push back) | server action | link and session, no code | Writes an append-only `agreement_note` and returns the phase to `agreement_draft` (criterion 23). |

## Printable, dynamic, unindexed

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/agreement/[token]/print` | GET | the project's link and session, or an admin session | The path segment is a link token; an admin may pass a project id instead, since admin never holds a token. Renders the print view, which has no field for internal cost (criteria 8, 15). |

## Team admin, dynamic, unindexed

No self-registration. Two accounts, created by `npm run admin:create`, which
prints a one-time setup link and never a password.

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/admin/login` | GET, server action | none | Rate limited to ten attempts in fifteen minutes per IP. An account with no password yet cannot be signed into. |
| `/admin/setup/[token]` | GET, server action | a valid, unused setup link | The person chooses their own password, at least twelve characters, and is signed in. The link works once and expires in 48 hours. |
| `/admin` | GET | admin | Projects, with the questionnaire state of each. |
| `/admin/clients` | GET | admin | Every client, who we talk to, their projects, and whether each link has gone out. |
| `/admin/clients/new` | GET, server action | admin | Adds a client on its own. Sends nothing. Can continue straight into a project. |
| `/admin/clients/[id]` | GET, server action | admin | The client record, their projects, and their contact details, edited here rather than on a project. |
| `/admin/clients/[id]/projects/new` | GET, server action | admin | Starts a project for that client. The sign-off person is asked here, defaulting to the day to day contact. Creating it mints the link, emails it and records `link_emailed_at` (criterion 22). |
| `/admin/projects/[id]/link` | GET, server action | admin | The handover. Shows the link in the clear while a fifteen minute cookie holds it, the WhatsApp message ready to send, and the email's state with a retry. Once that cookie is gone the link cannot be shown again, because only its hash is stored; rotating makes a new one. |
| `/admin/projects/[id]` | GET | admin | Phase, the agreement, invoices, sign-offs, the client link and its email status, the questionnaire, and the sign-off email confirmation. |
| `/admin/projects/[id]/agreement` | GET, server action | admin | The editor, with internal cost and notes in a block marked never shown to the client. Saving, sending, and the questionnaire override. |
| `/admin/projects/[id]/intake` | GET | admin | What they told us, with `entered_by` per answer. |
| `/admin/projects/[id]/intake/upload` | GET, server action | admin | Import or replace a questionnaire. Every failing rule is reported at once and nothing is saved (INTAKE-SPEC 14.2, 14.3). |
| `/admin/projects/[id]/intake/fill` | GET | admin | Typing answers from a call; each is marked `entered_by: team`. |
| `/admin/projects/[id]/intake/api/[action]` | POST | admin, same origin | The same actions as the client's, except `submit`, which only the client does. |
| `/admin/projects/[id]/intake/answers.json` | GET | admin | The answers document (INTAKE-SPEC 6). |
| `/admin/projects/[id]/file/[fileId]` | GET | admin | An uploaded file or its thumbnail. |
| `/admin/lib/[key]` | GET | admin | An image library picture. |
| `/admin/library` | GET, server action | admin | Upload, replace, delete. A key named by any uploaded questionnaire cannot be deleted. |

## Not built yet

Weekly updates, the review loop, delivery sign-off and the thank-you page, the
invoice print route and mark-paid, day 30, the needs-attention block, and
settings. Each arrives in its step; see `BUILD-LOG.md`.
