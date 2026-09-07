# ADR 0009: every entity leaves the domain through an audience serializer

## Status
Accepted, 5 Sep 2026

## Context
`agreement.internal_cost_paise`, `internal_notes`, `day30.friction_notes` and referral contacts must never reach a client, a print route, an export, a WhatsApp template or the activity log. Remembering to omit a field in each place is how leaks happen.

## Decision
`modules/serializers` exposes `toClientView`, `toAdminView` and `toPrintView` per entity. Client and print routes, templates, exports and the event writer accept only the client or print shape; the type system refuses a raw model. A leak-walk test requests every client and print route for the seed project and asserts on the bodies.

## Consequences
The boundary is structural and tested, not a convention. Adding a field means deciding its audience once. The cost is one mapping function per entity, which also happens to be where display formatting (paise to rupees, dates in Asia/Kolkata) belongs.
