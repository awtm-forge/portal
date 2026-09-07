# ADR 0003: clients authenticate by project link plus a one-time email code, never a password

## Status
Accepted, 5 Sep 2026

## Context
A client uses the portal a handful of times over a few months, on a phone, and must never be asked to remember anything. A password is a credential to store, reset and leak. A signature has to be attributable to a named person at a moment in time.

## Decision
Each project has one link carrying a 32-byte random token, stored only as a hash and compared in constant time. Opening the link on a new device sends a six-digit code to the sign-off person's email: ten minutes, five attempts, single use, then a thirty-day session cookie. Both sign-offs, agreement and delivery, require a fresh code even inside a valid session. Admin can rotate the token, which kills the old link at once.

## Consequences
No password table for clients exists to breach. The email address on the intake is load-bearing, so the link email at project creation doubles as a check that it works. A shared link lets someone view, never sign. Legal weight comes from the audit trail (criteria before, timestamped sign-off, invoice after), not from the code itself; the agreement copy says so plainly.
