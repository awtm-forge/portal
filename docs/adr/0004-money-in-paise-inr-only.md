# ADR 0004: money is an integer in paise, INR only in version one

## Status
Accepted, 5 Sep 2026

## Context
Invoices, advance percentages and totals must add up to the rupee across the agreement, two invoices and the printed words-in-figures line. Floats do not. International pricing in AED and USD exists in the offers but every invoice today is Indian.

## Decision
Every amount column is `BIGINT` paise. Formatting happens in one function in `lib/money`. No currency column in version one; international work is quoted by hand.

## Consequences
Arithmetic is exact and testable. Adding a currency later is a column on agreement and invoice plus a formatter and a words function per currency, with no screen changes (ARCHITECTURE.md, seams). Until then an international client's invoice is an INR invoice or a document produced outside the portal.
