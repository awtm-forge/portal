# ADR 0002: MySQL 8 via Prisma, in every environment including tests

## Status
Accepted, 7 Sep 2026

## Context
Hostinger provides MySQL. The two rules that must never fail, invoice numbering under concurrency and append-only evidence rows, depend on InnoDB row locks and transaction semantics. SQLite in tests would pass tests that production then fails.

## Decision
MySQL 8 everywhere: Docker Compose locally, a service container in CI, Hostinger's MySQL in production. Prisma for schema, migrations and queries, wrapped so that evidence tables expose only create and read.

## Consequences
Local setup needs Docker or a MySQL install; the brief says which. Prisma's migration history is the schema's source of truth; hand edits to the database are forbidden. Numbering uses a raw `SELECT ... FOR UPDATE` inside a Prisma interactive transaction because the ORM has no primitive for it.
