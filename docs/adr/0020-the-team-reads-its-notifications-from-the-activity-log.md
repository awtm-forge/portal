# ADR 0020: the team reads its notifications from the activity log

## Status
Accepted, 13 Sep 2026

## Context
The client has a notification feed in their portal (ADR 0017). The team had
only email: one plain-text message to `TEAM_NOTIFY_EMAIL` for each of the
moments CLAUDE.md §5 lists. That means knowing where things stand requires an
inbox, and a message missed is a message gone. Ayush on 13 September: "there is
no notification in admin portal, can you add that."

The needs-attention block on the dashboard is not this. It is computed on read
from dates and says what is going wrong now: silence, an unpaid invoice, a
questionnaire still open. It never says what happened.

Every one of those moments already writes an `activity_event`, which is the
record by ADR 0006. Mirroring them into an admin notification table would
store the same facts twice and leave the two able to disagree.

## Decision
The team's feed is a read of `ActivityEvent`, filtered to the types the team is
told about. No new table. Each admin keeps a single `notificationsSeenAt`
timestamp on `AdminUser`; unread is everything after it, and opening the page
moves it. One mapper, `teamNotice`, turns an event into the sentence, and both
the email subscriber and the page use it, so the two cannot drift.

## Consequences
The team can see what has happened without an inbox, with the count on the
sidebar, and each of the two admins keeps their own place. Nothing is written
when an event happens beyond the event itself, which was already being written.

The costs, honestly: unread is a watermark, not per item, so a person cannot
mark one thing unread or dismiss a single line; reading the page clears
everything above it. The feed can only ever show what the log holds, so a new
kind of notification means a new event type rather than a row someone inserts.
And the list is read from the log on each page load, which is one indexed query
by type and date, fine at this size and not at a hundred thousand events.
