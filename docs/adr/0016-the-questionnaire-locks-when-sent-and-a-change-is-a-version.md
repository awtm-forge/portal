# ADR 0016: the questionnaire locks when sent, and a change is a new version

## Status
Accepted, 10 Sep 2026

## Context
INTAKE-SPEC section 11 ends: after submitting, the page shows the answers
read-only with "You can still change any answer. Tap it." An answer could
change at any time after sending, silently. But the agreement is written from
these answers (13.3 gates the agreement on the sending), and the scope, the
price and the sign-off person come out of them. An answer that changes after
the agreement is drafted leaves two records that disagree, with nothing to
say which came first.

Ayush, 10 September: "once client is done with the questionnaire it gets
locked and they can request change after that. admin approves, then there
would be another version of it, so admin can access the new version, and
previous too."

## Decision
- **Sending locks the answers.** Every write to an answer, a section mark or
  an upload is refused on the server, inside the same transaction that would
  have written it, not only in the page. The access checklist is not locked:
  those ticks are granted over the days after sending, and the clock rule in
  that section depends on them staying live.
- **Every sending is a version.** `intake_version` holds the answers and the
  access ticks as they were, numbered from 1, with who sent it. Never
  updated, never deleted: guarded like `signoff_event`.
- **A change is asked for, in a line.** `intake_change_request`, with status
  asked, open, declined or sent, one live at a time. The client asks; the
  team opens it, or declines with the line the client reads; sending the
  changes closes it as the next version. The team can open one unasked, for
  a correction from a call, and can lock it again itself.
- **Admin reads any version**, with the answers that changed from the one
  before marked, and the answers JSON carries `answers_version` and can be
  fetched per version.
- **No new email to the client.** The team says it is open on WhatsApp with a
  prefilled line, as every other nudge goes. The team is emailed when a
  change is asked for and when the changes are sent.
- **No phase moves on a later sending.** Only the first sending moves a
  project out of intake.

## Consequences
- The last bullet of INTAKE-SPEC 11, and the second sentence of 13.1, are
  overridden for the time after sending. QUESTIONS.md Q14 records it for
  Rahul to confirm or reverse.
- Two tables and two enums, additive. The migration writes version 1 for
  every questionnaire already sent, so the record starts whole.
- The renderer has three sent states instead of one: locked, asked, open for
  changes. The one-thing-to-do rule holds: the only filled button is "Send
  the changes", and the ask is a folded text control like "Something is off"
  on the agreement.
- A client who wants to fix a typo now waits for a person. That is the
  trade: the answers stop being a scratchpad the moment they become what an
  agreement is written from. The needs-attention block shows the ask from
  the day it is made, so the wait is short.

## Alternatives considered
- Leave it, and mark "changed since sending" for admin. Rejected: there is
  still no record of what the agreement was written from.
- Lock, and let admin edit directly without versions. Rejected: loses who
  said what, and when.
- Email the client when it is opened. Rejected: a new kind of mail against
  CLAUDE.md section 4, "nothing else", when WhatsApp is how every other nudge
  already goes.
