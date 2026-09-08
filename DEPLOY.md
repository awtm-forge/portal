# Deploying the awtm forge portal on Hostinger

One Node.js web app on Cloud Professional, deployed from GitHub. Hostinger builds
on every push to the connected branch.

## Branches

- `main` holds step 1 only: the marketing site. Tag `step-1-marketing`. Deploy
  this first and confirm the Node environment works before anything else.
- `front-half` holds steps 2 to 4: schema, client login, admin, questionnaire.
  Merge it into `main` after the step 1 deploy is confirmed and the database
  and environment variables below exist.

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
| Domain | `portal.awtmforge.com`, with `dashboard.awtmforge.com` added to the same app |

Two hostnames, one app (ADR 0013). Add both domains to the same Node.js
application in hPanel and point both A records at it. `portal.awtmforge.com`
serves the client portal, `dashboard.awtmforge.com` serves the team admin, and
each refuses the other's zone. There is no marketing site on either: it left
the root on 9 September (ADR 0012), so both hostnames are private.

Hostinger applies `output: "standalone"` itself. `next.config.mjs` must keep
exporting a plain object, and stay plain JavaScript: the build host's glibc is
older than 2.29, so Next's native SWC cannot load and a TypeScript config
fails to transpile against the WASM fallback. The build script passes
`--webpack` for the same reason.

The build script runs `prisma generate`, then `prisma migrate deploy` when
`DATABASE_URL` is set (skipped when it is not, so step 1 builds without a
database), then `next build`.

## Environment variables

Set these in hPanel, never in the repo. None are needed for step 1.

| Name | Used for |
|---|---|
| `DATABASE_URL` | `mysql://USER:PASSWORD@localhost:3306/DBNAME`, from hPanel Databases |
| `SESSION_SECRET` | 32 or more random characters; signs session and code hashes |
| `UPLOAD_DIR` | an absolute path outside the deploy directory, `/home/zekst/awtm-uploads`. Create it with `mkdir -p` and `chmod 700`. |
| `APP_URL` | `https://portal.awtmforge.com`, where clients land. Every project link is built from it. Must include the scheme; a bare hostname is ignored with a warning. |
| `ADMIN_URL` | `https://dashboard.awtmforge.com`, where the team signs in. Team notification links are built from it. Leave empty to run both zones on `APP_URL`. |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `hello@awtmforge.com` |
| `SMTP_PASS` | that mailbox's password |
| `SMTP_FROM` | `awtm forge <hello@awtmforge.com>` |
| `TEAM_NOTIFY_EMAIL` | where team notifications go: intake submitted, agreed, delivered, and every enquiry |
| `TZ` | `Asia/Kolkata` |

Without `SMTP_HOST` the app refuses to send codes in production.

## After the front-half deploy, over SSH

Hostinger Cloud plans include SSH. From the app directory:

```bash
npm run admin:create -- rahul@zyphextech.com "zekst"
```

```bash
npm run admin:create -- ayushphiks@gmail.com "Ayush"
```

Each prints a one-time setup link. Open it within 48 hours and choose your own
password, at least twelve characters. The command never generates or prints a
password, and no password is ever typed into a terminal or a message. Running
it again replaces the link, which is also how a forgotten password is reset.
Two accounts is the limit. The email is what you sign in with; the name is what
the admin pages show.

Then seed the image library with the six logo directions:

```bash
npm run db:seed
```

The seed also creates a sample project, Kavya Appliances, and prints its
client link. Delete that project before real use, or keep it as a demo.

## Checks

1. Open https://portal.awtmforge.com on a phone. The awtm forge fonts, no
   horizontal scroll, and the page says to open the link that was emailed.
2. https://portal.awtmforge.com/robots.txt is `Disallow: /`. Both hostnames
   are private; there is nothing here to index.
3. `curl -sI https://dashboard.awtmforge.com/admin` shows
   `x-robots-tag: noindex, nofollow` and `cache-control: no-store`.
4. The hosts hold apart: `curl -so /dev/null -w "%{http_code}"
   https://portal.awtmforge.com/admin` is 404, and the same against
   `https://dashboard.awtmforge.com/p/anything` is 404. If either is 200,
   `ADMIN_URL` is unset or does not match, and both zones are answering on
   both names.
5. Uploads survive a redeploy: put a marker file in `UPLOAD_DIR`, push a
   trivial commit, confirm the marker is still there. If it is not, uploads
   need a different home and the build stops to say so.
6. Stop MySQL from hPanel and load `/`. The way-in page still renders: it
   reads nothing.

## Known and accepted

- The marketing site is not served here. It is kept whole and compiling at
  `src/components/marketing/MarketingSite.tsx` and is not routed (ADR 0012).
  When it returns it gets its own hostname. Its "How we work" section already
  carries the one-agreement copy from `CLAUDE.md` section 8.
- `/api/enquiry` and the `enquiry` table are still here and still work. They
  cost nothing while nothing posts to them.
- The client link is shown once, when created and when rotated, because
  only its hash is stored (PORTAL-SPEC 5.9). The nudge message points at
  the link already sent.
- HEIC uploads are refused with a message asking for a JPG (INTAKE-SPEC 16).
- The app process is stopped by Hostinger when idle and restarted on the next
  request, so the first visit after a quiet spell takes a few seconds.
