# ADR 0011: the phase write is conditional, and is what stops a sign-off happening twice

## Status
Accepted, 8 Sep 2026

## Context
Both sign-offs read the project, check its phase, and then write a `signoff_event` and an invoice. Nothing held the row between the read and the write. Under InnoDB's repeatable read, two concurrent transactions both see the earlier phase on their own snapshot, both pass the check, and both go on to write. The result is two sign-off events and two invoices, which acceptance criteria 1, 2 and 6 forbid.

In the portal this never surfaced, because the one-time code is consumed with a conditional `updateMany` whose row count is checked, so the second caller fails there first. The concurrency control was the OTP, by accident. The WhatsApp recording path added in step 6 has no code and therefore no such guard: two fast submits of that form could raise two advance invoices. Step 8 was about to add a second form of the same shape for the balance.

CLAUDE.md section 11 already required that every phase change go through one function. No such function existed; six places computed the target phase and wrote the column themselves.

## Decision
`transition(tx, project, event)` in `modules/projects/phase.ts` is the only thing that writes `project.phase`. It writes conditionally, on the phase still being what the caller read, and throws `PhaseRaced` when the update matches no row. It is called first inside each sign-off transaction, before any other write.

Side effects branch on the transition's declared `effects` at the call site, rather than through a dispatch table. The declaration is therefore load-bearing: removing an effect from the table removes the behaviour, and the tests in `tests/phase.test.ts` became behavioural rather than documentary.

## Consequences
The phase column is the mutual exclusion token for the whole journey, at the cost of one conditional write. A caller that loses the race rolls back before writing anything and reports it as "already agreed" or "already delivered", which is what happened from its point of view; nobody sees a stack trace for clicking twice.

Every phase change now runs through code that can be read in one place, and a route file no longer writes the column. The cost is that callers must pass a transaction client and the phase they read, which is the discipline that makes the guarantee real. `tests/signoff-concurrency.test.ts` runs two sign-offs in parallel and asserts exactly one of everything; it fails against the previous implementation.
