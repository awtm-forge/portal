# awtm forge Client Portal

**Scope: from the client's first login to an approved testimonial.**
Everything before that, the enquiry, the discovery call, and how the client came to say yes, is out of scope and lives elsewhere. A project enters this system when Rahul creates it after the discovery call.

**This is not a separate app. It is part of awtmforge.com.** The marketing site and the portal are one Next.js codebase on one domain, sharing one design system. See §3.1.

Version 2, 5 Sep 2026. Supersedes version 1, which had four payment-gated stages. This version has one agreement, one review, two invoices.

---

## 1. What this is

A small web app with two users:

- **The team** (two people, Rahul and Ayush). Authenticated. Creates projects, uploads the questionnaire, writes the agreement, sends weekly updates, runs the review, issues invoices, reads what came back.
- **The client.** No password. One link per project, confirmed with a one-time code per device. They answer the questionnaire, read and agree the agreement, watch the build through weekly updates, book a sync when they want one, review the finished work, say yes to it, see their invoices, and thirty days after delivery give one number and approve one quote.

It replaces five things that currently happen by memory or on WhatsApp alone: the intake questionnaire, the agreement, the final review and sign-off, the invoice, and the day-30 conversation.

**It does exactly two jobs WhatsApp is bad at: showing what was agreed, and recording a yes.** Everything conversational stays on WhatsApp.

**The rule that governs every client-facing screen: the client is never shown more than one thing to do.** No navigation, no sidebar, no tabs. One column. The current step is the only loud thing on the page; everything else is collapsed or below it. If a client can describe any page as more than "it told me what was happening and what to do", that page is too complicated. INTAKE-SPEC.md §11 shows what this means in practice on the busiest page they will see.

### The journey, in order

1. Rahul creates the project and sends the link. The client opens it, enters the code, and sees the questionnaire.
2. The client answers the questionnaire (INTAKE-SPEC.md).
3. Rahul writes the agreement from the answers: scope, deliverables, timeline, price, payment split. Internal cost lives beside it and the client never sees it.
4. The client reads the agreement and agrees. That is the one sign-off. The advance is invoiced.
5. Kickoff. The build runs. Every week a written update appears on the client's page and goes to WhatsApp. Every two weeks a sync, booked by either side through the booking link on the page.
6. Rahul marks the work ready for review. The client checks it against the deliverables, and either says what is off, or says yes.
7. If something is off, Rahul fixes it and sends it back. As many rounds as it takes, each recorded.
8. The client says yes. That is delivery. The balance is invoiced. The retainer starts or the handover happens.
9. Thirty days later, the day-30 page: one number, one quote.

---

## 2. Non-goals, do not build these

- Passwords. The client's login is the project link plus a one-time code per device, which is a login without a credential to store or forget. See §5.9.
- Chat, comments or threads. The review page has one box per round for "what is off"; that is a record, not a conversation.
- Task management, time tracking, team assignment, Gantt anything.
- Payment gateway integration (invoices are paid by bank transfer and marked paid by hand).
- The referral mechanism (deliberately parked; leave no half-built stubs).
- Per-milestone payments or per-milestone sign-offs. There is one agreement and one delivery. If that changes, it is a new version of this document, not a feature flag.
- Editing a questionnaire inside the portal. INTAKE-SPEC.md §10.
- **Any field that stores a secret belonging to the client.** No passwords, API keys, OTPs, card numbers or access credentials for their systems, ever, in any table or form. If a feature seems to need one, stop and flag it. The intake's access section is checkboxes recording that the client granted something from inside their own account. It never accepts, transmits or stores the thing itself.
- A form builder. The intake has eight field types and no conditional logic; INTAKE-SPEC.md §3 draws that line and it does not move.
- Showing internal cost, margin, or team pay to a client on any route, in any export, in any WhatsApp template.

---

## 3. Stack

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js (App Router), TypeScript | `output: 'standalone'` in `next.config` to keep the runtime light |
| Styling | Tailwind | Mobile first. The client opens this on a phone. |
| Database | MySQL via Prisma | Hostinger Cloud Professional provides MySQL |
| Hosting | Hostinger Cloud Professional, Node.js app, GitHub deploy | One app on `awtmforge.com`, marketing and portal together |
| Email | nodemailer over SMTP from the existing `hello@awtmforge.com` mailbox | Used **only** for the one-time code |
| PDF | A print-styled route, printed by the browser | **No puppeteer, no headless Chrome.** If server-side PDF is ever needed, use pdfkit. |
| Booking | An external booking link (Google Calendar appointment schedule or Calendly) embedded on the client page | Not built. Configured once in settings. The booking tool sends the notification. |

**Fallback if the Next runtime fights Hostinger's Node environment on memory:** Express plus server-rendered templates. The schema and business rules below do not change. Do not attempt this fallback unless deployment actually fails.

### 3.1 Routes and the marketing site

One codebase, one domain, three zones:

| Zone | Routes | Rendering | Indexed |
|---|---|---|---|
| Marketing site | `/`, `/work`, `/contact`, etc. | Static (SSG) | Yes |
| Client portal | `/p/[token]`, `/p/[token]/intake`, `/p/[token]/agreement`, `/p/[token]/review`, `/p/[token]/day30` | Dynamic, no cache | **No** |
| Team admin | `/admin/*` | Dynamic, auth required | **No** |
| Printable | `/invoice/[id]/print`, `/agreement/[id]/print` | Dynamic, auth or token required | **No** |

Rules that follow from sharing a domain:

- **Marketing pages must be statically generated.** They keep serving even if the database is unreachable. Never fetch from the database in a marketing route.
- `robots.txt` disallows `/p/`, `/admin/`, `/invoice/`, `/agreement/`. Every page in those zones also sends `X-Robots-Tag: noindex, nofollow` and a `<meta name="robots" content="noindex, nofollow">`. A client's agreement and invoice amounts must never reach a search index.
- Portal and admin routes send `Cache-Control: no-store`.
- The marketing site's existing content is the current dummy site. Port it as-is into Next components. Do not redesign it as part of this build. **Its "How we work" section describes four payment-gated stages and must be rewritten to match this version before launch; that copy change is a separate task and is flagged in §11.**
- One shared design system: the same tokens, typography and components serve both zones. A client who lands on the portal should recognise it as the same company.

---

## 4. Data model

Amounts are **integers in paise**. No floats anywhere near money.

```
company                      -- singleton row
  name, address, email, phone, logo_url
  bank_name, bank_account_name, bank_account_number, bank_ifsc, upi_id
  invoice_prefix             -- e.g. "AWTM"
  gstin                      -- nullable, null for now
  booking_url                -- the external booking link shown to clients
  default_advance_pct        -- e.g. 50; the split is a setting, not a rule

client
  id, business_name
  contact_name, contact_phone, contact_email
  signoff_person_name, signoff_person_email
                             -- seeded from the intake (dec_signoff_*), editable in admin

project
  id, client_id, name, slug, type_of_work
  phase                      -- intake | agreement_draft | agreement_sent | agreed
                             --   | building | in_review | delivered | closed
  access_token_hash          -- hash only, never the token
  token_created_at, token_rotated_at
  week_count                 -- planned build length, for "week 4 of 8"
  metric_name, metric_baseline_value, metric_baseline_captured_at
  after_delivery             -- retainer | handover | undecided
  retainer_tier, retainer_named_person, retainer_response_time
  handover_doc_url
  delivered_at
  created_at

agreement                    -- one per project, the document the client signs
  id, project_id
  scope                      -- text, in the client's words from the intake
  deliverables               -- json: [{ key, text, how_to_check }]  the review checks against these
  not_included               -- text
  start_date, launch_target_date
  milestones                 -- json: [{ label, date }]  shown as dates, never as sign-offs
  total_paise
  advance_pct                -- copied from company default, editable per project
  how_we_work                -- text: weekly update, biweekly sync, the booking link
  if_we_miss                 -- text
  after_delivery_offer       -- text: the retainer or handover terms
  internal_cost_paise        -- ADMIN ONLY. Never on a client route, export, or template.
  internal_notes             -- ADMIN ONLY.
  sent_at
  agreed_at, agreed_by_name, agreed_method   -- portal | whatsapp
  version                    -- increments if re-sent before agreement; agreed version is frozen

signoff_event                -- append only, never updated or deleted
  id, project_id
  kind                       -- agreement | delivery
  occurred_at
  method                     -- portal | whatsapp
  actor_name
  ip, user_agent             -- null for whatsapp
  raw_note                   -- for whatsapp: the pasted message
  agreement_version          -- for kind=agreement

update                       -- the weekly written update
  id, project_id, week_number, sent_at
  moved, next_up, need_from_you, need_by_date, risks, staging_url

review_round
  id, project_id, round_number
  sent_at                    -- when Rahul marked it ready
  staging_url
  client_note                -- the "what is off" box, null if accepted
  responded_at
  outcome                    -- changes_requested | accepted | open

invoice
  id, project_id
  kind                       -- advance | balance | other
  number                     -- string, see §5.7
  issued_at
  amount_paise, tax_amount_paise, total_paise
  status                     -- issued | paid | cancelled
  paid_at, paid_reference, payment_method

day30
  id, project_id
  unlocks_at, opened_at
  metric_after_value, metric_after_submitted_at
  testimonial_draft, testimonial_approved_text, testimonial_approved_at
  permission_use_name, permission_use_logo
  friction_notes             -- admin only

intake, intake_file, image_library   -- see INTAKE-SPEC.md §12
```

---

## 5. Business rules

Enforce these **in the data layer, not only in the UI.**

**5.1 Two invoice moments, and only two.** The advance invoice is created when the agreement is signed off. The balance invoice is created when delivery is signed off. Both are triggered by a `signoff_event` and by nothing else. Amounts come from `agreement.total_paise` and `agreement.advance_pct`. There is no manual "create invoice" for these two; `kind=other` exists for a genuine extra, and it is the only kind an admin can raise by hand.

**5.2 Phase transitions are one-way and gated.**
`intake → agreement_draft` when the intake is submitted (or overridden, recorded).
`agreement_draft → agreement_sent` when Rahul sends it.
`agreement_sent → agreed` only by a `signoff_event` of kind `agreement`.
`agreed → building` when Rahul marks kickoff done.
`building → in_review` when Rahul marks it ready; `in_review → building` when the client requests changes.
`in_review → delivered` only by a `signoff_event` of kind `delivery`.
`delivered → closed` by hand, after day 30.

**5.3 The agreement cannot be sent until the intake is submitted.** Admin override exists and records who and when.

**5.4 Sending the agreement freezes nothing; agreeing freezes everything.** Before agreement, Rahul can edit and re-send, and `version` increments. After `agreed_at` is set, the agreement is read-only forever. A change after that is new work with a new agreement, or a note on the record, never an edit.

**5.5 The review loop.** Marking ready creates a `review_round` with `outcome=open`. The client either writes what is off (outcome `changes_requested`, phase back to `building`) or says yes (a `signoff_event` of kind `delivery`, outcome `accepted`, phase `delivered`). Rounds are unlimited and every one is kept.

**5.6 Delivery sign-off** sets `project.delivered_at`, creates the balance invoice, creates the `day30` row with `unlocks_at = delivered_at + 30 days`, and either starts the retainer record or surfaces the handover checklist, per `after_delivery`.

**5.7 Invoice numbering.** Format `{prefix}/{FY}/{seq}`, for example `AWTM/26-27/007`. The Indian financial year runs 1 April to 31 March. `seq` is zero-padded to three digits, resets each financial year, is allocated inside the same database transaction that issues the invoice, and is **never reused and never skipped**. A cancelled invoice keeps its number.

**5.8 GST.** Render tax lines only when `company.gstin` is set. Until then `tax_amount_paise = 0` and no tax line appears. Build the field now so registering later is a settings change.

**5.9 The client token.** 32 bytes from `crypto.randomBytes`, base64url. Store only a hash. Compare in constant time. Admin can rotate it, which invalidates the old link immediately.

**5.10 The one-time code.** Opening the link on a new device sends a six-digit code to `client.signoff_person_email`, valid ten minutes, five attempts, single use. On success a thirty-day session cookie is set for that device. **Both sign-offs, agreement and delivery, ask for a fresh code even inside a valid session.** That is what makes them attributable. Viewing does not.

**5.11 The WhatsApp fallback is first-class.** When a client replies "ok done" on WhatsApp instead of tapping, admin records it: the pasted message, the date, who said it. This writes the same fields and a `signoff_event` with `method=whatsapp` and `raw_note` set. **The two methods remain distinguishable forever.**

**5.12** `signoff_event` rows are append-only. No update path, no delete path, no cascade.

**5.13** `agreement.internal_cost_paise` and `internal_notes` are excluded at the query layer from every client route, every print route, every export and every WhatsApp template. This is enforced by a serializer the client routes must use, not by remembering to omit a field.

**5.14** Rate limit the code-request and code-verify endpoints per token and per IP.

---

## 6. Screens

### 6.1 Client: the project page (`/p/[token]`)

One column. What it shows depends on `phase`, and only the current phase is loud.

- **intake:** "Before we start, about ten minutes." One button into the questionnaire. Nothing else.
- **agreement_sent:** "Your agreement is ready to read." One button into it.
- **agreed / building:** "Week 4 of 8." The latest weekly update, in full. A "Book a sync" button that opens `company.booking_url`. Below the fold, collapsed: earlier updates, the agreement (read-only), the advance invoice.
- **in_review:** "Ready for you to check." One button into the review.
- **delivered:** "Delivered on [date]." The balance invoice. Then either the retainer's named person and response time, or the handover document. Below, collapsed: everything above.
- **day 30 unlocked:** "One month in. Two things, under a minute." One button.
- **closed:** the record, read-only.

The footer, always: who to message on WhatsApp, and that the link does not expire.

### 6.2 Client: the intake (`/p/[token]/intake`)

INTAKE-SPEC.md, in full.

### 6.3 Client: the agreement (`/p/[token]/agreement`)

The document, rendered: what we are building in their words, the deliverables list with how each will be checked, what is not included, the dates, the price and how it splits, how we work, what happens if we miss, what happens after delivery. At the bottom, one button: "I agree." It asks for a code, then stamps: agreed by [name] on [date]. After that the page is the frozen record and the button is gone. A print stylesheet makes it a clean PDF.

Nothing about internal cost appears here. §5.13.

### 6.4 Client: the review (`/p/[token]/review`)

The deliverables list from the agreement, each with its "how to check it yourself" line and the staging link. Below it, one text box: "Anything that is off? Say it here and we keep working. Nothing is invoiced until you are happy." And one button: "It holds. Sign off the delivery." The button asks for a code. Previous rounds show beneath, collapsed: what was said, when, what changed.

### 6.5 Client: day 30 (`/p/[token]/day30`)

Locked until `unlocks_at`. The metric line from the agreement and one field, "and now?" Then the drafted quote in an editable box, two switches (name and company; logo), one Approve button. No referral section.

### 6.6 Admin

- **Projects list** with a **Needs attention** block computed on read: intake unsubmitted for five days, agreement sent and unsigned for five days, no update in eight days during `building`, a review round open for three days, an invoice unpaid for seven days, a day-30 page unlocked and unopened.
- **Project detail.** Phase and the one action that moves it. The questionnaire (upload, view, replace; INTAKE-SPEC §10). The agreement editor, with the internal cost and notes in a visibly separate block marked "never shown to the client." Weekly updates. Review rounds. Invoices, with mark-paid. Day 30 draft and friction notes. The client link, copy and rotate. Record a WhatsApp sign-off.
- **Settings.** Company details, bank details, invoice prefix, GSTIN, booking URL, default advance percentage.

Admin auth: email and password for two accounts, argon2 or bcrypt, httpOnly session cookie, CSRF on mutations. No self-registration.

### 6.7 Printable (`/invoice/[id]/print`, `/agreement/[id]/print`)

Clean print-styled pages. The invoice: company block, client block, number and date, one line item naming the project and whether it is the advance or the balance, total in figures and words, bank details, the GST block only when `gstin` is set. The agreement: the same content as §6.3 with the sign-off stamp. Neither carries internal cost.

---

## 7. WhatsApp prefilled links

Every outbound message is generated from the record and opens WhatsApp with the text written. Format:

```
https://wa.me/{phone_digits_only}?text={encodeURIComponent(body)}
```

Five templates, each a function of the record, none of which can reference `internal_cost_paise`:

- **Questionnaire ready.** The link, and that it takes about ten minutes.
- **Agreement ready.** The link, and that it is one page.
- **Weekly update.** The five fields, exactly as stored.
- **Ready for review.** The link, the deliverables count, and the line that nothing is invoiced until they are happy.
- **Invoice issued.** Number, amount, advance or balance, and the portal link.
- **Day 30 unlocked.** One minute, one number and one approve, with the link.

---

## 8. Design

Mobile first. **The portal and the marketing site share one design system**: the same tokens, type scale and components. Build the tokens once and use them in both zones.

Follow the awtm forge palette, supporting both themes with these as the dark set:

```css
--ground:#141110; --surface:#1B1715; --surface-2:#221D1A;
--ink:#EDE7DC;   --muted:#A69C8E;   --faint:#7A7166;
--rule:#2E2925;  --rule-soft:#252019;
--ember:#E08536; --ember-deep:#B5661F; --ember-soft:#2E2115;
```

Define the complete light palette on bare `:root`, redefine tokens under `@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. No colour may exist only inside a media query.

No em dashes in any user-facing copy, comments or commit messages.

---

## 9. Build order

Ship each step working before starting the next. Steps 1 to 4 are the front half and may already be underway.

1. Next.js scaffold, shared tokens and components, the marketing site ported into static routes. **Deploy this first.** The Hostinger Node environment gets tested against a trivial app.
2. Schema and migrations for everything in §4 and INTAKE-SPEC §12. Seed one realistic project in `building` with a submitted intake, an agreed agreement, an advance invoice paid, three updates.
3. Client login: link plus one-time code per device, thirty-day session. Admin auth and the projects list.
4. The questionnaire, per INTAKE-SPEC in full.
5. The agreement: admin editor with the internal block, client page, code-gated sign-off, `signoff_event`, advance invoice created on agreement, print route.
6. The WhatsApp sign-off recording path, for both kinds.
7. Weekly updates on both sides, the booking button, the WhatsApp prefilled links.
8. The review loop: mark ready, client review page, changes-requested rounds, code-gated delivery sign-off, balance invoice, retainer or handover surfacing.
9. Invoice numbering, mark paid, print route.
10. Day 30 unlock, the number, the quote.
11. Needs attention block.
12. Deploy to `awtmforge.com`.

---

## 10. Acceptance criteria

1. Signing off the agreement creates exactly one invoice, `kind=advance`, for `total × advance_pct`, with the next sequential number. No other action creates an advance.
2. Signing off delivery creates exactly one invoice, `kind=balance`, for the remainder. Requesting changes creates no invoice.
3. There is no admin action that creates an `advance` or `balance` invoice by hand. `other` is the only kind an admin can raise.
4. Two invoices issued in the same financial year have consecutive numbers with no gap. One issued on 1 April starts a new sequence at 001. Concurrent issuance never duplicates a number.
5. Both sign-offs require a fresh code even inside a valid session. Viewing any page does not. A code is single use, ten minutes, five attempts.
6. A `signoff_event` exists for every agreed agreement and every accepted delivery, and `method` correctly distinguishes a portal tap from a recorded WhatsApp reply.
7. After `agreed_at` is set, no admin control can change any field on the agreement. Before it, editing and re-sending increments `version`.
8. `internal_cost_paise` and `internal_notes` never appear in the response body of any `/p/`, `/invoice/`, `/agreement/` route, any export, or any WhatsApp template. Verified by a test that requests every client route for the seed project and asserts on the body.
9. Rotating a project's token makes the previous link return 404 on the next request.
10. The day-30 page is inaccessible before `unlocks_at` and requires no scheduled job to become accessible after it.
11. No table, form, or log in the system can hold a client credential, key, password or OTP belonging to the client's own systems.
12. Every rupee amount in the database is an integer in paise, and each invoice total in words matches the figure.
13. On a 375px screen, every client page shows exactly one primary action above the fold, and no navigation.
14. Both themes render with no unstyled or invisible text.
15. Both printable routes print on A4 with no navigation, no buttons, correct margins, and no internal cost.
16. There is no code path that deletes a `signoff_event`, an issued invoice, or a `review_round`.
17. Marketing pages render with the database stopped. Confirm by stopping MySQL and loading `/`.
18. `/p/`, `/admin/`, `/invoice/` and `/agreement/` are disallowed in `robots.txt` and send `noindex, nofollow` as both a header and a meta tag.
19. Portal and admin responses send `Cache-Control: no-store`.
20. A client landing on the portal sees the same typography, colour and component language as the marketing site.
21. The intake acceptance criteria in INTAKE-SPEC §14 all pass.

---

## 11. Open questions to raise rather than guess

If any of these becomes load-bearing during the build, stop and ask rather than deciding:

- **The default advance percentage.** Invoicing is parked as a business decision. Build it as `company.default_advance_pct`, seed it at 50, and expect it to change. Do not hard-code a split anywhere.
- **The marketing site's "How we work" section** still describes four payment-gated stages and 30/30/30/10. It contradicts this version and must be rewritten before launch. That is a copy task for Rahul, not a build task, but the build should not go live with it as-is.
- Whether the one-time code goes to email or phone. Email is assumed because SMS needs a provider and KYC.
- What happens to a project cancelled mid-build. Not covered here.
- Whether Ayush needs a different permission level from Rahul. Assumed not.
- Whether the client-side booking button uses a Google Calendar appointment schedule (free if hello@ is on Workspace) or Calendly. Either is a URL in settings; the build does not care.
