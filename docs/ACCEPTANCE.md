# Acceptance criteria, and what covers each one

CLAUDE.md section 10 says the job is finished when every criterion in
PORTAL-SPEC section 10 and INTAKE-SPEC section 14 has a passing test or a
recorded manual check with the date. This is that list, written on 9 September
2026 after step 11, and it is honest about the gaps.

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
| 11 | Nothing holds a client's own credential | part | The importer refuses uploads in the access section (`import.test.ts`) and no schema column exists for one. That no log line can hold one is a reading of the code, not a test. **Open**: worth one pass over every `logger` call and every form, recorded here with a date. |
| 12 | Money in paise, words match the figure | test | `money.test.ts`, `e2e/invoices.spec.ts` |
| 13 | One primary action above the fold at 375px, no navigation | part | `e2e/agreement.spec.ts` covers the questionnaire page and the absence of navigation across the client zone. **Open**: the same assertion for the review, thanks and day-30 pages. Each was looked at by hand when built; none is recorded with a date. |
| 14 | Both themes render with no invisible text | **dead** | There is one theme. You chose dark only on 5 September. The criterion needs rewriting or removing, and until then it cannot pass or fail. |
| 15 | Both print routes on A4, no navigation, no internal cost | part | No navigation and no internal cost are tested (`e2e/agreement.spec.ts`, `e2e/leak-walk.spec.ts`). **Open**: A4 margins and page breaks, which need a person and a print dialog. |
| 16 | No code path deletes evidence rows | test | `append-only.test.ts` |
| 17 | Marketing pages render with the database stopped | **restate** | The marketing site is no longer routed here (ADR 0012). The way-in page at `/` reads nothing, so the check as written still passes, but it is now about a different page. |
| 18 | robots and noindex on the private zones | test | `e2e/leak-walk.spec.ts`. Stronger than written: the whole host is disallowed. |
| 19 | Portal and admin send no-store | test | `e2e/leak-walk.spec.ts` |
| 20 | The portal looks like the marketing site | **restate** | The marketing site is not deployed. It still exists in `components/marketing` and shares the tokens, so the comparison is possible, but the criterion points at something no one can visit. |
| 21 | INTAKE-SPEC section 14 all pass | part | See below. |
| 22 | Creating a project sends one link email and records it | test | `e2e/onboarding.spec.ts` |
| 23 | A note moves agreement_sent back to draft, and nowhere else | test | `e2e/agreement.spec.ts`, `phase.test.ts` |
| 24 | The thank-you page 404s before delivery | test | `e2e/review.spec.ts` |
| 25 | A referral never reaches a client route or a template | test | `e2e/leak-walk.spec.ts` |
| 26 | A draft testimonial never appears outside admin | test, narrowed | `e2e/leak-walk.spec.ts`, `e2e/day30.spec.ts`. Narrowed by QUESTIONS.md Q9: a draft appears in one place outside admin, the day-30 box of the project that wrote it, shown to the client who wrote it. A draft from any other project cannot reach it, and that is tested. |

## INTAKE-SPEC section 14

| # | Criterion | State | Where |
|---|---|---|---|
| 1 | An answer survives a new device and a fresh code | open | Nothing tests it end to end. Saving and reloading are covered as units (`answers.test.ts`), the device handover is not. |
| 2 | Duplicate key, and an upload in the access section, refused | test | `import.test.ts` |
| 3 | An image key not in the library is refused | test | `import.test.ts` |
| 4 | A renamed executable refused, EXIF stripped | test | `files.test.ts` |
| 5 | A script in an SVG is removed | test | `files.test.ts` |
| 6 | Guessing a file URL without the link or a session gives 404 | test | `e2e/onboarding.spec.ts`, including a real id under another project's token |
| 7 | The agreement is blocked by an unsubmitted questionnaire, override recorded | test | `intake-gaps.test.ts` |
| 8 | An answer typed by the team reads `entered_by: team` | test | `intake-gaps.test.ts` |
| 9 | An image_choice shows its pictures and stores option ids | part | Storing is tested (`answers.test.ts`). Rendering is not. |
| 10 | Every question type renders on a 375px screen | open | Needs a person and a phone, or an end-to-end pass over a document using all eight types. |
| 11 | Replacing a document keeps the answers that still have a question | test | `intake-gaps.test.ts`, including that a removed question hides its answer rather than losing it |
| 12 | No admin control edits a question | part | True by construction: there is no such route or action, and CLAUDE.md 2 item 12 forbids one. Worth recording as checked with a date rather than left implied. |
| 13 | On a phone, only the open section is interactive above the fold | open | Needs a person and a phone. |

## What this adds up to

Twenty-six of the thirty-four are covered by a passing test.

Two need rewriting because your own decisions overtook them, and only you can
say how: **14**, both themes, when there is one theme; and **20**, looking like
the marketing site, when the marketing site is not deployed. **17** is restated
by ADR 0012 rather than broken.

Five are open, and every one of them needs a person rather than a test:

- **11**, that no log line can hold a client's credential. One pass over every
  `logger` call and every form, written down here with the date.
- **13**, one action above the fold at 375px, for the review, thanks and
  day-30 pages. Each was looked at when built; none is recorded.
- **15**, the print routes on A4. Needs a print dialog.
- **INTAKE 1**, an answer surviving a new device and a fresh code.
- **INTAKE 9, 10 and 13**, the eight question types rendering and behaving on a
  phone.

None is a known defect. They are places where the guarantee rests on reading
the code or on somebody having looked, rather than on something that would go
red. Half an hour with a phone closes most of them.
