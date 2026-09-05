# Deploying awtmforge.com on Hostinger

One Node.js web app on Cloud Professional, deployed from GitHub. Hostinger builds
on every push to `main`.

## hPanel settings, once

Websites, Add website, Node.js web app, Import Git repository, connect the
`zekst` GitHub account, pick `zekst/awtmforge`.

| Setting | Value |
|---|---|
| Framework | Next.js (auto-detected) |
| Node version | 22 |
| Root directory | `/` |
| Build command | `build` |
| Output directory | `.next` |
| Entry file | leave as detected; Hostinger ignores it for Next.js |
| Branch | `main` |
| Domain | awtmforge.com |

Hostinger applies `output: "standalone"` itself. `next.config.ts` must keep
exporting a plain object.

## Environment variables

None are needed for step 1 (the marketing site). Later steps add these in
hPanel, never in the repo:

| Name | Used for |
|---|---|
| `DATABASE_URL` | MySQL, from hPanel Databases |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | the one-time code, sent from hello@awtmforge.com |
| `SESSION_SECRET` | signing session cookies |
| `UPLOAD_DIR` | an absolute path outside the deploy directory, for client uploads |

## After the first deploy

1. Open https://awtmforge.com on a phone. The page should render in the
   awtm forge fonts with no horizontal scroll.
2. Open https://awtmforge.com/robots.txt. It disallows `/p/`, `/admin/`,
   `/invoice/`, `/agreement/` and `/api/`.
3. Later, when `UPLOAD_DIR` exists: write a marker file there, push a trivial
   commit, and confirm the marker survived the redeploy. If it did not,
   uploads need a different home and the build stops to say so.

## Known and accepted

- The "How we work" section still describes four payment-gated stages. It
  is ported as-is. PORTAL-SPEC section 11 assigns the rewrite to Rahul.
- The enquiry form answers "could not send" until the database step lands.
