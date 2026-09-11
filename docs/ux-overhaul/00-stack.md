# 00. The stack, as found

Written 11 Sep 2026 at the start of the UX overhaul, from the repo, not from memory. AI-assisted.

| Layer | What is here | Notes for the overhaul |
|---|---|---|
| Framework | Next.js 16.3.4, App Router, React 19.2, TypeScript 5 strict, `output: standalone` applied by the host | Server components by default; client components only where state lives (`"use client"`: the questionnaire renderer, code screen, login form, a few admin forms). Middleware is `src/proxy.ts` (Next 16 naming). Build is `next build --webpack` because the host's glibc cannot load SWC. |
| Routing | Three zones on one host: client `/p/[token]/*` (the token is a bearer link; the literal `me` resolves from the session), admin `/admin/*` (route groups `(auth)` and `(app)`), printable `/agreement/[token]/print` and `/invoice/[id]/print`. `/` is the way-in page. `/healthz` reports build, mail and admin seats. | 44 route files. Full list in `01-screen-inventory.md`. |
| Styling | Tailwind 4 via `@tailwindcss/postcss` is installed and imported once in `src/app/globals.css`, but the product is styled by hand-written CSS classes: tokens on `:root` in `globals.css` (colours, three font stacks), and component classes in `src/components/portal/portal.css` (client shell, cards, fields, buttons, questionnaire, print, admin `a-*` classes). Dark is the only theme, by decision on 5 Sep 2026; `color-scheme: dark`. | One token layer already exists and is the single source; extend it (spacing, radius, motion) rather than add a second. Tailwind utilities are barely used; I will not migrate to them. |
| Components | No component library. Shared pieces live in `src/components/portal/` (ClientShell, Journey, InvoiceList, WeeklyUpdate, AgreementDocument, InvoiceDocument) and `src/components/intake/IntakeRenderer.tsx` (the questionnaire), `src/components/admin/AdminShell.tsx`. Buttons, cards and fields are CSS classes, not components. | The primitives the brief asks for (toast, skeleton, confirm dialog, empty state, step indicator) do not exist yet. |
| State and data | Server actions with `useActionState` for forms; the questionnaire posts JSON to `/p/[token]/intake/api/[action]` and autosaves per field. No client-side store. Reads go through `src/modules/*` (domain modules, no HTTP or React) and `src/modules/serializers` (per-audience views; the client shape has no internal-cost field by type). | ADR 0009: the serializer is the only way a model reaches a view. Several front-half route files still import Prisma directly; listed in BUILD-LOG. |
| Auth | Client: bearer link token (hash stored on `Client`), per-client session cookie `awtm_c_<clientId>` (30 days), six-digit one-time codes by email for login and for each sign-off (`CodePurpose`), rate limited. No client password exists, by design. Admin: email + bcrypt password, session cookie, first account via `/admin/first-run` with `SETUP_KEY`, second seat via a one-time setup link from Settings. | Satisfies the brief's "one-time link" requirement. The admin never sees a client credential because there is none. |
| Database | MySQL 8 via Prisma 7 with `@prisma/adapter-mariadb`; local in Docker (`awtm-mysql`, port 3307); migrations in `prisma/migrations` (hand-edited where a backfill is needed). Money is integer paise. Append-only guards in `src/lib/db.ts` for evidence rows. | Local work only ever points at the Docker database. |
| Email | nodemailer over SMTP (`SMTP_*` env); `MAIL_TRANSPORT=log` writes mail to the server log for dev and tests; production with no `SMTP_HOST` refuses to send. Subscribers in `src/modules/notifications` (team emails, client emails, client in-portal notifications) react to activity events from `src/modules/events`. | Every mail is plain text. Codes and links never appear in logs except in the dev log transport. |
| Files | Uploads under `UPLOAD_DIR` outside the web root, validated by magic bytes, images re-encoded and EXIF stripped, SVG sanitised; served only through authenticated routes. | Image library for `image_choice` questions. |
| Deployment | Hostinger Cloud Node.js app, auto-deploys `main` on push (about 2.5 minutes), one host `dashboard.awtmforge.com` (single-host mode; `ADMIN_URL` unset). `/healthz` carries the commit hash. | `DEPLOY.md` is the runbook. This overhaul works on the `ux-overhaul` branch and never deploys on its own. |
| Tests | Vitest (unit, real MySQL) and Playwright (desktop Chrome and Pixel 7 projects, against a production build on port 3210 with the log mailer). About 160 unit and 140 end-to-end tests at the start of this work. | `tests/e2e/fixtures.ts` plants known codes and rotates seed links. |
| Lint and types | ESLint 9 with `eslint-config-next`; `tsc --noEmit`. | Both green at the start. |

## What is deliberately absent

No queue, no separate API, no GraphQL, no repository layer over Prisma, no feature flags (docs/ARCHITECTURE.md). No light theme. No client password. No questionnaire editor in the portal (a revised questionnaire is uploaded as a new document).

## Brand check

`grep -rni zyphex src public` returns nothing: no client-facing surface, email, print route or metadata names Zyphex Tech.
