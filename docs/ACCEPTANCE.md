# Acceptance criteria, and what covers each one

CLAUDE.md section 10 says the job is finished when every criterion in
PORTAL-SPEC section 10 and INTAKE-SPEC section 14 has a passing test or a
recorded manual check with the date. This is that list, written on 9 September
2026 after step 11 and kept true since, last on 10 September 2026, and it is
honest about the gaps.

Three columns of truth: **test** means an automated test asserts it and is
green; **checked** means a person looked, with the date; **open** means
neither, and says what it would take.

## PORTAL-SPEC section 10

| # | Criterion | State | Where |
|---|---|---|---|
| 1 | One advance invoice on agreement, no other path | test | `e2e/agreement.spec.ts`, `signoff-concurrency.test.ts` |
| 2 | One balance on delivery, none on changes requested | test | `e2e/review.spec.ts`, `phase.test.ts` |
| 3 | No admin action raises advance or balance | test | `invoices.test.ts`, `e2e/invoices.spec.ts` |
| 4 | Numbers consecutive, reset per year, safe in parallel | test | `invoice-numbering.test.ts` |
| 5 | Both sign-offs need a fresh code | test | `e2e/agreement.spec.ts`, `e2e/review.spec.ts` |
| 6 | A sign-off event for each, method kept | test | `e2e/agreement.spec.ts`, `e2e/whatsapp-signoff.spec.ts` |
| 7 | Frozen after agreement, version increments before | test | `e2e/agreement.spec.ts` |
| 8 | Internal cost never in a client body, export or template | test | `e2e/leak-walk.spec.ts`, `serializers.test.ts` |
| 9 | Rotating a link 404s the old one | test | `e2e/onboarding.spec.ts` |
| 10 | Day 30 shut before the date, no scheduled job | test | `day30.test.ts`, `e2e/day30.spec.ts` |
| 11 | Nothing holds a client's own credential | test | `import.test.ts` for the access section, `logger.test.ts` for the log. Checked 9 Sep 2026: every client-zone form input is `code`, `intent`, `metricAfter`, `name`, `quote`, `referralContact`, `referralName`, `text`, `token`, `useLogo`, `useName`, and no schema column could hold one. The audit found that `String(error)` could carry a database or SMTP password into a log line; `safeError` now redacts credentials in URLs and anything token-shaped. |
| 12 | Money in paise, words match the figure | test | `money.test.ts`, `e2e/invoices.spec.ts` |
| 13 | One primary action above the fold, no navigation | test, reworded three times | `e2e/layout.spec.ts` walks every client page at both widths the suite runs. Two rewordings: QUESTIONS.md Q10, three pages have none and should; and Q11, the criterion names 375px and this is a web product, so the rule is tested at any width. Q15, 10 September: a quiet row of links and a Reach us control are on every page at Ayush's request, so "no navigation" is tested as "no loud navigation": text links only, no tabs. `e2e/navigation.spec.ts` covers the row itself. |
| 14 | Both themes render with no invisible text | **dead** | There is one theme. You chose dark only on 5 September. The criterion needs rewriting or removing, and until then it cannot pass or fail. |
| 15 | Both print routes on A4, no navigation, no internal cost | test, and checked 10 Sep 2026 | No navigation and no internal cost are tested (`e2e/agreement.spec.ts`, `e2e/leak-walk.spec.ts`). A4 checked on 10 September by printing both routes to PDF with headless Chromium, with and without backgrounds, and reading every page: the agreement runs to two A4 pages with no heading left at the foot of one, the invoice to one. The check found the print palette was the screen palette, so with backgrounds off the text was near-white on white; fixed the same day by swapping the colour tokens for print. |
| 16 | No code path deletes evidence rows | test | `append-only.test.ts` |
| 17 | Marketing pages render with the database stopped | **restate** | The marketing site is no longer routed here (ADR 0012). The way-in page at `/` reads nothing, so the check as written still passes, but it is now about a different page. |
| 18 | robots and noindex on the private zones | test | `e2e/leak-walk.spec.ts`. Stronger than written: the whole host is disallowed. |
| 19 | Portal and admin send no-store | test | `e2e/leak-walk.spec.ts` |
| 20 | The portal looks like the marketing site | **restate** | The marketing site is not deployed. It still exists in `components/marketing` and shares the tokens, so the comparison is possible, but the criterion points at something no one can visit. |
| 21 | INTAKE-SPEC section 14 all pass | part | See below. |
| 22 | The link goes out once, and is recorded | test, reworded | `e2e/onboarding.spec.ts`. Reworded by ADR 0015: saving a client mints the link and emails nothing; sending the questionnaire, or starting the first project, emails it once and records `link_emailed_at`. |
| 23 | A note moves agreement_sent back to draft, and nowhere else | test | `e2e/agreement.spec.ts`, `phase.test.ts` |
| 24 | The thank-you page 404s before delivery | test | `e2e/review.spec.ts` |
| 25 | A referral never reaches a client route or a template | test | `e2e/leak-walk.spec.ts` |
| 26 | A draft testimonial never appears outside admin | test, narrowed | `e2e/leak-walk.spec.ts`, `e2e/day30.spec.ts`. Narrowed by QUESTIONS.md Q9: a draft appears in one place outside admin, the day-30 box of the project that wrote it, shown to the client who wrote it. A draft from any other project cannot reach it, and that is tested. |

## INTAKE-SPEC section 14

| # | Criterion | State | Where |
|---|---|---|---|
| 1 | An answer survives a new device and a fresh code | test | `e2e/layout.spec.ts`, with two browser contexts, which is what a second device is |
| 2 | Duplicate key, and an upload in the access section, refused | test | `import.test.ts` |
| 3 | An image key not in the library is refused | test | `import.test.ts` |
| 4 | A renamed executable refused, EXIF stripped | test | `files.test.ts` |
| 5 | A script in an SVG is removed | test | `files.test.ts` |
| 6 | Guessing a file URL without the link or a session gives 404 | test | `e2e/onboarding.spec.ts`, including a real id under another project's token |
| 7 | The agreement is blocked by an unsubmitted questionnaire, override recorded | test | `intake-gaps.test.ts` |
| 8 | An answer typed by the team reads `entered_by: team` | test | `intake-gaps.test.ts` |
| 9 | An image_choice shows its pictures and stores option ids | test, and checked 10 Sep 2026 | Storing is tested (`answers.test.ts`). Rendering checked on 10 September at phone width on the seed questionnaire: the six logo directions show as a two-column grid of pictures with the caption beneath, and the chosen one is marked. |
| 10 | Every question type renders on a small screen | test, and checked 10 Sep 2026 | `e2e/layout.spec.ts` asserts the questionnaire does not scroll sideways and offers one action, at 375 and at 1440. Checked on 10 September at phone width, every section of the seed questionnaire open in turn: all eight types render and are answerable, and no section scrolls sideways. |
| 11 | Replacing a document keeps the answers that still have a question | test | `intake-gaps.test.ts`, including that a removed question hides its answer rather than losing it |
| 12 | No admin control edits a question | part | True by construction: there is no such route or action, and CLAUDE.md 2 item 12 forbids one. Worth recording as checked with a date rather than left implied. |
| 13 | Only the open section is interactive above the fold | test | `e2e/layout.spec.ts`, at both widths |

## What this adds up to

Thirty-one of the thirty-four are covered by a passing test.

Three need rewriting, and only Rahul can say how:

- **14**, both themes render, when you chose one theme on 5 September. It
  cannot pass or fail as written.
- **20**, the portal looks like the marketing site, when the marketing site is
  not deployed. It still exists in `components/marketing` and shares the
  tokens, so the comparison is possible, but the criterion points at something
  nobody can visit.
- **13**, twice over. It asks for exactly one primary action above the fold
  when three pages have none and should (Q10), and it names a 375px screen
  when this is a web product (Q11). It is tested as "never more than one",
  plus "exactly one where the page asks for something", at both widths.

**17** is restated by ADR 0012 rather than broken: the way-in page at `/` reads
nothing, so the check still passes, about a different page.

The three that wanted a person were checked on 10 September 2026 (15, INTAKE 9
and INTAKE 10, above), with a headless print to A4 standing in for the print
dialog. One of them found a defect, the print palette, fixed the same day.

## Checked against the live site

`dashboard.awtmforge.com`, 9 September 2026, on the build carrying step 11.

| Check | Result |
|---|---|
| `robots.txt` | `Disallow: /`, the whole host |
| Headers on `/admin` | `noindex, nofollow`, `no-store`, `no-referrer` |
| `/healthz` | `{"status":"ok"}`, so the database answers |
| `/p/anything` | 404 |
| `/` | carries no internal cost or notes |

Checked since, on 10 September 2026: a real one-time code arrived, once the
six `SMTP_*` variables were set in hPanel and the app redeployed; `/healthz`
reports `"mail":"smtp"` and names the six variables it sees.

Not yet checkable, and it needs Ayush:

- **The two hosts holding apart.** `portal.awtmforge.com` has no DNS record and
  `ADMIN_URL` is unset, so the app is running single-host. That is a valid way
  to deploy and nothing is wrong; the split simply is not on yet.

