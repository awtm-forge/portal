# ADR 0012: the marketing site leaves the root, and this host serves the portal only

## Status
Accepted, 9 Sep 2026

## Context
`CLAUDE.md` section 1 describes one codebase on one domain with three zones: the marketing site static at `/`, the client portal at `/p/`, and the team admin at `/admin/`. Step 1 built the marketing site and it has been serving `/` since 5 September.

Rahul decided on 9 September that this deployment is the portal, not the website. The marketing site is not wanted at the root of this host, and the deliverable he is asking for is the client portal and the team admin.

Deleting it was one of the options offered and was not taken. It is ported work that passes its own checks, and the wording in section 8 of `CLAUDE.md` was written for it.

## Decision
The marketing page moves from `src/app/page.tsx` to `src/components/marketing/MarketingSite.tsx`. It is no longer routed. It still compiles, so it cannot rot silently, and putting it back is one file that renders it.

`/` becomes a small way in: it says the project page opens from the link that was emailed, that there is no password, and offers a quiet team sign-in. A client never needs it, because their link goes straight to their own project; it exists for whoever types the bare domain.

The whole host is now private. `robots.txt` disallows everything rather than carving out four prefixes, and `/` joins the zones that send `noindex, nofollow` and `no-store`. The zones are still listed one by one in `next.config.mjs` rather than as a catch-all, because a catch-all would also put `no-store` on Next's content-hashed static assets.

## Consequences
`CLAUDE.md` section 1 and PORTAL-SPEC section 9 step 1 are out of step on this point, and this ADR is the record of why. The rule in `CLAUDE.md` section 2 item 7, that marketing routes are statically generated and never touch the database, has nothing to apply to on this host; the check it describes, stopping MySQL and loading `/`, still passes, because the way-in page reads nothing either.

`/api/enquiry` and the `Enquiry` table stay. They are reachable and tested, and they cost nothing until the site returns. When the marketing site comes back it gets its own host, and this ADR is where to start.
