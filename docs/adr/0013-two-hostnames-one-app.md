# ADR 0013: two hostnames, one app

## Status
Accepted, 9 Sep 2026

## Context
Rahul asked for two portals, one for clients and one for the team. They already are two in the way that matters: separate sign-in, separate session cookies, separate layouts, and serializers that make handing a client an admin view a type error rather than an oversight.

What they shared was a hostname. Three options were put to him: leave them on one host and two paths, give each its own hostname from one app, or deploy two apps. He chose the second.

Two deployments was the option `CLAUDE.md` section 11 rules out without an ADR naming the problem it solves. It did not name one: it buys isolation the serializers already provide, and costs two builds, two deploys, shared code either duplicated or packaged, and migrations owned by one of them. For two founders and one node that is the wrong trade.

## Decision
One codebase, one Hostinger app, two DNS records. `APP_URL` is where the client portal answers; `ADMIN_URL` is where the team admin answers. `src/lib/hosts.ts` is the only thing that reads them.

`src/proxy.ts` refuses a zone that does not belong to the host it arrived on: no `/admin` on the client host, no `/p/` on the team host. It answers 404 rather than redirecting, because the other host is not this host's business to advertise. The printable routes answer on both, because a client saves their own invoice from theirs and the team opens the same document from theirs. The bare team host redirects to the projects list.

When `ADMIN_URL` is unset, or resolves to the same hostname, nothing is refused. That is what development and the end to end tests run on, and it stays a valid way to deploy.

A value that is not an absolute http or https URL is ignored, with a warning. Without that, an `ADMIN_URL` with the scheme forgotten would put a string that is not a link into every team email.

## Consequences
A client never sees an admin URL, and the two sessions cannot end up in one cookie jar, which they could on a single host. The cost is one middleware rule, one environment variable, a second DNS record, and remembering that links must be built through `clientBase()` or `adminBase()` rather than by reading `APP_URL` directly.

This is not a security boundary on its own. Anyone who learns the team hostname can reach the login page there. What keeps client data from the team's views, and the team's internal cost from the client's, is the serializers and the session checks, exactly as before.
