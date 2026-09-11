# ADR 0017: the client is notified, in the portal and by email

## Status
Accepted, 11 Sep 2026

## Context
The client was told nothing when the team acted. They got the link email and
one-time codes, but nothing when the agreement was sent, the work was ready to
review, a weekly update went up, or their questionnaire was opened for a
change. Ayush on 11 September: "there should be proper notification system for
the client so client can get notified." Q19.

## Decision
A second subscriber on the activity dispatcher (ADR 0006), beside the team one.
For the events that concern the client it writes a `ClientNotification` row,
shown in the portal with an unread bell and an Updates page, and for the ones
that ask them to look or act it also emails them.

- **Which events**: `agreement.sent` (added, it was never emitted),
  `review.opened`, `update.sent`, `intake.change_opened`, `intake.change_declined`.
  A client's own actions and the team's internal events produce nothing. A
  pure mapper decides, so it is unit tested without a database.
- **The email links to `/p/me`** (ADR 0018/Q18), which is why the login work
  came first: an email cannot carry the token, so it points at the session
  entry, which logs them in if the session has lapsed.
- **No internal cost can reach it**: the payloads are already serialized (ADR
  0009), and the notice text is written here from names only.
- **Best effort**: a failure to notify never breaks the change that caused it;
  the subscriber catches and logs.

## Consequences
- One additive table, `ClientNotification`. The shell reads an unread count on
  every client page for the bell, one indexed count.
- Weekly updates now email the client. That is one email a week during the
  build, which is the point; a client who does not want them can say so and we
  stop sending, but there is no unsubscribe surface in v1.
- Day 30 has no event (it unlocks by arithmetic), so there is no day-30
  notification yet. When it matters, a scheduled check or a delivery-time
  "we will be back in a month" note is the seam.
