# Deploying awtmforge.com on Hostinger

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
| Domain | awtmforge.com |

Hostinger applies `output: "standalone"` itself. `next.config.ts` must keep
exporting a plain object.

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
| `APP_URL` | `https://awtmforge.com` |
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

1. Open https://awtmforge.com on a phone. The awtm forge fonts, no
   horizontal scroll.
2. https://awtmforge.com/robots.txt disallows `/p/`, `/admin/`, `/invoice/`,
   `/agreement/` and `/api/`.
3. `curl -sI https://awtmforge.com/admin` shows `x-robots-tag: noindex, nofollow`
   and `cache-control: no-store`.
4. Uploads survive a redeploy: put a marker file in `UPLOAD_DIR`, push a
   trivial commit, confirm the marker is still there. If it is not, uploads
   need a different home and the build stops to say so.
5. Stop MySQL from hPanel and load `/`. It still renders.

## Known and accepted

- The "How we work" section still describes four payment-gated stages. It
  is ported as-is. PORTAL-SPEC section 11 assigns the rewrite to Rahul.
- The client link is shown once, when created and when rotated, because
  only its hash is stored (PORTAL-SPEC 5.9). The nudge message points at
  the link already sent.
- HEIC uploads are refused with a message asking for a JPG (INTAKE-SPEC 16).
- The app process is stopped by Hostinger when idle and restarted on the next
  request, so the first visit after a quiet spell takes a few seconds.
