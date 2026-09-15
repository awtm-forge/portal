# Deploying the awtm forge portal on Hostinger

One Node.js web app on Cloud Professional, deployed from GitHub. Hostinger builds
on every push to the connected branch.

Deploy `main`. The two-branch staging plan this file used to describe is
finished: `front-half` was merged long ago and is twenty commits behind, and
the marketing-site-first deploy it existed for no longer applies (ADR 0012).
The branch is still on the remote and can be deleted whenever Rahul says so.

What is deployed: every step of PORTAL-SPEC section 9, live at
`dashboard.awtmforge.com` and rebuilt by Hostinger on each push to `main`. A
client is added and gets their link, fills the questionnaire, agrees the
agreement, receives weekly updates, checks the delivery, signs it off, sees
both invoices, and comes back at day 30. Both portals run on the one hostname
today; the two-host split in ADR 0013 is supported and switched off.
`/healthz` reports the running commit, so a deploy is verified by polling it.

## hPanel settings, once

Websites, Add website, Node.js web app, Import Git repository, connect the
`zekst` GitHub account, pick `awtm-forge/portal`.

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
`DATABASE_URL` is set, then `next build`. Migrations run on every deploy and
are additive, so a deploy never drops a column out from under a running
process. With `DATABASE_URL` unset the migration step is skipped rather than
failing, which is how the very first build can succeed before the database
exists.

## Environment variables

Set these in hPanel, never in the repo. Every one of them is needed.

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
| `TEAM_NOTIFY_EMAIL` | `hello@awtmforge.com`, the team inbox, so both founders see them. Where team notifications go: intake submitted, agreed, changes requested, delivered, day 30 approved, and every enquiry. One address, not a list. |
| `TZ` | `Asia/Kolkata`. All dates, the financial year boundary and invoice dates are computed here. |
| `NODE_ENV` | `production`. Hostinger sets this itself; confirm it, because the seed uses it to keep demo projects out. |

Do not set `MAIL_TRANSPORT`. It exists so the tests can write mail to the log
instead of sending it, and setting it in production would silently stop every
one-time code from being delivered.

A value saved in hPanel reaches the app only on the next deploy. After adding
or changing one, press Redeploy on the Deployments page, or push a commit, and
wait for the deploy to finish. `/healthz` reports `"mail":"smtp"` once the
SMTP values are live, and its `commit` field says which build answered.

Without `SMTP_HOST` the app refuses to send codes in production, on purpose,
rather than failing quietly. The consequence is absolute: no client can get
past the code screen, so no client can sign in at all. Set the five `SMTP_*`
variables before the first project link is sent, and run check 6 below with a
real address before trusting it.

## First run, over SSH

### If the server will not run a script

Hostinger's Node deploy ships a pruned build: no dev dependencies and, on this
account, no `scripts/` directory, so `npm run admin:create` may not run there
at all, over SSH or from the panel. When that is the case, use the first-run
page instead (ADR 0014):

1. Set `SETUP_KEY` in hPanel to any long random string, and restart the app.
2. Open `https://dashboard.awtmforge.com/admin/first-run`.
3. Give your email, your name and that key. It makes the one account and takes
   you to the screen where you choose a password.
4. Delete `SETUP_KEY` afterwards.

The page only exists while there are no admin accounts. The moment one exists
it is a 404, on that deployment, for good. With no `SETUP_KEY` set it refuses
rather than letting whoever finds it claim the system.

That leaves `db:seed` unrun, so the company row and the image library are
missing: the invoice prefix, the advance percentage and the six logo
directions the questionnaire refers to. Settings has fields for the first two.

### Over SSH, when the server will run a script

**Nobody can sign in until this is done.** The production database is not the
one on anyone's laptop: an account created locally does not exist here. Until
`admin:create` has run on the server, `/admin/login` renders and refuses every
password, because there is no account to match.

Hostinger Cloud plans include SSH, and hPanel has a browser terminal that does
the same job. Node is not on the PATH in a bare SSH session on this account,
and the app is not in your home directory, so start with:

```bash
export PATH=/opt/alt/alt-nodejs22/root/usr/bin:$PATH
```

Then change into the directory that has both `node_modules` and `.next`, which
is the one the running process was built in. Hostinger assembles the app under
`~/domains/<domain>/hbuilds/`, and the copy of `package.json` in `hbuilds/config`
has no dependencies installed beside it, so it is not the one to stand in.

`tsx` and `dotenv` are runtime dependencies rather than dev ones, because both
commands below need them and the deployed directory holds production
dependencies only. That was found the hard way on 9 September: `admin:create`
failed with `tsx: command not found` on a server where the build had plainly
succeeded, because the build runs somewhere the app does not.

From that directory:

```bash
npm run admin:create -- rahul@awtmforge.com "Rahul"
```

If SSH is fighting you, hPanel's Node.js application page has a **Run NPM
script** control that runs in the app's own environment, with `DATABASE_URL`
already set. It cannot pass arguments, so set two variables on that same page
and run `admin:create` with none:

| Name | Value |
|---|---|
| `ADMIN_EMAIL` | `rahul@awtmforge.com` |
| `ADMIN_NAME` | `Rahul` |

Delete both once the account exists. They are not secret, they are just clutter.

```bash
npm run admin:create -- ayushphiks@gmail.com "Ayush"
```

Each prints a one-time setup link, built from `ADMIN_URL` when that is set and
from `APP_URL` when it is not, so it always points at the host the admin
actually answers on. Open it within 48 hours and choose your own password, at
least twelve characters. Setting the password signs you straight in; there is
no second login screen.

If the link it prints starts with `http://localhost`, then neither `APP_URL`
nor `ADMIN_URL` is set on the server. Fix that first, or the link is useless. The command never generates or prints a
password, and no password is ever typed into a terminal or a message. Running
it again replaces the link, which is also how a forgotten password is reset.
Two accounts is the limit. The email is what you sign in with; the name is what
the admin pages show.

Then seed the company row and the six logo directions the questionnaire
refers to:

```bash
npm run db:seed
```

With `NODE_ENV=production` this seeds the company row and the image library
and nothing else. It says so on the last line. The two demo projects are
development data: they use fictional clients and they print a client link,
which is a bearer credential, and there is no delete-project path by design,
so a demo project seeded here would stay for good. If you want one anyway,
`npm run db:seed -- --demo`, and know what you are choosing.

Then open `/admin/settings` and fill in the bank details. Without them a
printed invoice has no account number on it, and the admin invoice list will
tell you so on every project. The invoice prefix is `AWTM` and refuses to
change once invoices carry it. Leave GSTIN empty until you register: see
`QUESTIONS.md` Q7, because the tax rate is not decided.

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
5. `curl -s https://portal.awtmforge.com/healthz` is `{"status":"ok"}`. It is
   200 only when the database answers, so it is the first thing to check when
   something looks wrong. Point Hostinger's monitor at it.
6. A real one-time code arrives. Add a throwaway client with your own address
   as the contact, open their link on a phone, ask for the code, and confirm it
   reaches you. No project is needed. This is the one check that proves SMTP,
   and nothing else does.
7. Uploads survive a redeploy: put a marker file in `UPLOAD_DIR`, push a
   trivial commit, confirm the marker is still there. If it is not, uploads
   need a different home and the build stops to say so.
8. Stop MySQL from hPanel and load `/`. The way-in page still renders: it
   reads nothing. `/healthz` goes 503 while it is down, which is correct.
   Start MySQL again.

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
  request, so the first visit after a quiet spell takes a few seconds. Nothing
  lives in process memory, so this costs latency and nothing else.
- Every step of PORTAL-SPEC section 9 is built and live; the day-30 page and
  the needs-attention block landed on 9 and 10 September.

## Starting clean before the first real client

The portal was tried out with test clients, some of whom signed off and were
invoiced. A sign-off, an issued invoice and a review round have no delete
path, not even for test data, so those clients cannot be removed from the
admin, and the test invoices hold real numbers in this year's sequence. The
answer is one wipe, before the first real client and never after: every client
and everything that ever happened to them goes, and the invoice numbering
starts again at 0001. Your admin logins, your settings and the image library
stay.

1. Take a backup first, with the `mysqldump` line under Backups below.
2. Run `scripts/reset-before-launch.check.sql` and read the numbers. It only
   reads. If any client in that count is real, stop here.
3. Run `scripts/reset-before-launch.sql`. Either copy both files over with
   `scp` and run `mysql -u USER -p DBNAME < scripts/reset-before-launch.sql`
   over SSH, or paste the file into the SQL tab of phpMyAdmin in hPanel.
4. Remove the test uploads directory, `/home/zekst/awtm-uploads/clients`, and
   leave `/home/zekst/awtm-uploads/library` alone: that is the image library.
5. Check: `curl -s https://dashboard.awtmforge.com/healthz` shows
   `"clients":{"rows":0,"withoutCopy":0}`, and the projects list is empty.

The first real invoice is then `AWTM/26-27/0001`. Rehearsed on the local
database on 15 September 2026: the kept tables came through whole and every
other count read zero.

## Backups

Hostinger's own backups cover the account. Take our own of the database as
well, because a bad migration is not what those are for. Nightly, over SSH or
as a cron entry in hPanel:

```bash
mysqldump --single-transaction --routines --no-tablespaces -u USER -p DBNAME | gzip > ~/backups/awtm-$(date +%F).sql.gz
```

`--single-transaction` so the dump is consistent without locking the site.
Keep thirty days, and delete anything older:

```bash
find ~/backups -name 'awtm-*.sql.gz' -mtime +30 -delete
```

The uploads directory needs the same treatment and is not in the dump:

```bash
tar czf ~/backups/uploads-$(date +%F).tar.gz -C /home/zekst awtm-uploads
```

A restore has to be tested once before it is worth anything. Step 11 puts that
in `docs/RUNBOOK.md`; until then, do it by hand into a scratch database and
write down what you did.
