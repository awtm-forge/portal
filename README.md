# awtmforge.com

The awtm forge marketing site and client portal, one Next.js application on one domain. The portal takes a client from their first login to an approved testimonial: a questionnaire, one agreement with a code-gated sign-off, weekly updates, a review loop, one delivery sign-off, two invoices and a day-30 page.

Built AI-assisted from the specifications in this repo. The judgement in them is Rahul's and Ayush's.

## Running it locally

Five commands from a fresh clone. Node 22 and Docker are the only prerequisites.

```bash
npm install
```

```bash
docker compose up -d
```

```bash
cp .env.example .env
```

Fill `.env`: `DATABASE_URL` is `mysql://awtm:awtmdev@127.0.0.1:3307/awtm` for the Compose database, `SESSION_SECRET` is any long random string, `UPLOAD_DIR` is a path outside the repo, `APP_URL` is `http://localhost:3200`. Leave the SMTP values empty; with no `SMTP_HOST` the mailer writes to the server log and one-time codes appear there. No route reveals a code, in any environment.

```bash
npx prisma migrate dev && npm run db:seed
```

```bash
npm run dev
```

The site is on http://localhost:3200. The seed prints a client link for the sample project. Admin is at `/admin`; create an account with `npm run admin:create`.

## Tests

```bash
npm test
```

Unit tests with Vitest for rules, money and serializers. End-to-end tests with Playwright for the client screens and admin actions run with `npm run test:e2e`, and need the database up. Both run against MySQL, never SQLite: invoice numbering and the append-only rules depend on InnoDB behaviour that another engine would fake (ADR 0002).

```bash
npm run typecheck && npm run lint
```

## Where things are

- `src/app/` routes only: validate the input, call a module, render a view.
- `src/modules/` the domain, one folder per area, no HTTP and no React in it.
- `src/lib/` database client, mailer, money, dates, files, rate limiting.
- `prisma/` schema, migrations and the seed.
- `docs/` the design this code is built to, kept true in the same commit as the code.

## Documentation

- `CLAUDE.md` the standing brief: non-negotiables, working method, decisions taken after the specs.
- `PORTAL-SPEC.md` and `INTAKE-SPEC.md` the source of truth for behaviour.
- `docs/ARCHITECTURE.md` zones, boundaries and the seams where later features attach.
- `docs/DATA-MODEL.md` the entities, the rules the schema enforces, the phase machine.
- `docs/DFD.md` what flows where. `docs/SEQUENCES.md` the four interactions where order matters.
- `docs/adr/` the accepted decisions, one file each.
- `BUILD-LOG.md` what is built, what is deferred and where each deferral lands. `QUESTIONS.md` what is waiting on Rahul. `CHANGELOG.md` one line per step.
- `DEPLOY.md` the runbook for deployment. `docs/HANDOVER.md` the material the build started from.
