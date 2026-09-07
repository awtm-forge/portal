# ADR 0006: an append-only activity event log with an in-process dispatcher for side effects

## Status
Accepted, 7 Sep 2026

## Context
Team emails, WhatsApp prefilled links, the needs-attention block and any future integration all react to the same handful of moments. Calling each of them from inside the module that made the change couples everything to everything and makes the next feature a change to old code.

## Decision
Every meaningful change writes an `activity_event` row and emits it through one dispatcher. Subscribers in `modules/notifications` do the emailing and template rendering. The dispatcher is a function call, not a queue. `signoff_event` stays a separate, narrower table because it is legal evidence with its own fields.

## Consequences
New side effects are new subscribers. Admin gets a timeline for free. Payloads pass through the client serializer before being written, so internal cost cannot reach the log. If volume ever needs a queue, the dispatcher's interface is the seam; nothing else changes. The cost is one extra row per change, which is nothing at this scale.
