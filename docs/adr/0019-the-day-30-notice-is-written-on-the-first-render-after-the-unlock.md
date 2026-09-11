# ADR 0019: the day-30 notice is written on the first render after the unlock

## Status
Accepted, 11 Sep 2026

## Context
Every client notification (ADR 0017) is a subscriber to an activity event: the
team sends the agreement, marks the work ready, sends an update, opens the
questionnaire. The month-on page is different. It opens on a date,
`day30.unlocksAt`, thirty days after delivery, and nothing acts on that date:
the unlock is a comparison made on read (criterion 10). So no event fires and
the client was never told the page had opened (UX audit F-16). The
architecture (docs/ARCHITECTURE.md) deliberately has no scheduler and no
queue, and CLAUDE.md §11 says not to add one without an ADR naming the problem
it solves. A scheduler for one email a month is not that problem.

## Decision
The client home, when it renders a delivered project whose day-30 row is
unlocked and unanswered, calls `tellDay30Due(clientId)`. That writes the
`day30.due` notification row and sends the email through the same path as the
event-driven notices, once per client: it checks for an existing row of that
kind first. The team's needs-attention list already covers the case where the
client never opens the page.

## Consequences
The notice arrives the first time the client opens their page after day 30,
which is also the moment it is actionable, and there is still no scheduler.
The cost: a read-time side effect on a GET, idempotent and harmless to repeat;
a client who never returns after delivery is not emailed by this path (the
team's WhatsApp nudge from the project page remains the way to reach them);
and two first renders racing could write the row twice, which is rare and
shows as one duplicate line on the updates page.
