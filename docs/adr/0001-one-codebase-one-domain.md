# ADR 0001: one Next.js codebase for the site, the portal and the admin, on one domain

## Status
Accepted, 5 Sep 2026

## Context
The marketing site and the client portal share a brand, a design system and a two-person team. Hostinger Cloud Professional runs one Node.js app comfortably; two apps means two deploys, two sets of tokens and a seam where the client notices they left the website. The marketing site must stay up if the database is down.

## Decision
One Next.js App Router codebase on awtmforge.com. Marketing routes are statically generated and never read the database. Portal, admin and print routes are dynamic, send noindex and no-store, and are disallowed in robots.txt.

## Consequences
One deploy, one design system, one place for tokens. The portal's uptime is tied to the site's, so the site's static build is the safety net. A future move of the portal to its own host is a route prefix change, because nothing in the marketing zone imports from the portal zone.
