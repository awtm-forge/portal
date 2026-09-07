# ADR 0005: project phase is an explicit state machine with a transition table

## Status
Accepted, 7 Sep 2026

## Context
Nine phases, two of them reached only through a code-gated sign-off, several with side effects (invoices, day-30 row, retainer). Spread across screens as conditionals, the rules drift and a new screen can skip one.

## Decision
`modules/projects/phase.ts` holds the transition table: from-phase, event, to-phase, side effects. Every phase change goes through `transition()`. Illegal moves throw. Side effects are attached to the transition, not to the screen that triggered it.

## Consequences
The journey is one file that reads like the spec. Adding a step is a row plus a screen. Tests enumerate every allowed and every refused move. The cost is discipline: no route may write `project.phase` directly, and the Prisma wrapper hides that column's setter.
