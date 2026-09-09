# ADR 0014: a first-run page, because the host cannot run a script

## Status
Accepted, 9 Sep 2026

## Context
`scripts/admin-create.ts` makes the first admin account and prints a one-time
setup link. It is the only way into a fresh deployment, and `DEPLOY.md` has
told Ayush to run it since the first draft.

On 9 September Rahul tried to sign in to the live site and could not, because
no account existed there. Every route to creating one failed in turn:

- `npm run admin:create` over SSH: `tsx: command not found`. The deployed
  directory holds production dependencies only. Fixed by moving `tsx` and
  `dotenv` into dependencies, which was right regardless.
- After that fix, the app directory could not be found at all. A search of the
  home directory turned up exactly one `node_modules`, and it was the npx
  cache. Hostinger builds under `hbuilds/` and runs a pruned bundle, and the
  `package.json` that does sit there has nothing installed beside it.
- hPanel's script runner cannot pass arguments, so `admin:create` was changed
  to read `ADMIN_EMAIL` and `ADMIN_NAME` from the environment. That helps only
  if the panel can run the script at all, which on this account it may not.

The pattern is that this host does not reliably give us a shell next to the
application. A deployment plan whose first step is "run a command on the
server" is not one this host can carry out.

## Decision
`/admin/first-run` makes the first account, and only ever the first.

Three conditions, each closing a different hole. Nobody may be able to sign in
yet: the page is a 404 the moment any account has a password, so it is not a
way to add an account later or to take over a live system.

The rule is "can anyone sign in", not "does a row exist", and that distinction
was learned the hard way. An account made by `admin:create` has no password
until somebody opens its setup link. On the live site an earlier attempt had
left exactly such a row, so the first-run page hid itself behind an account
nobody could use: a locked door with no key. Counting rows bricked the very
deployment the page exists to rescue. Creation upserts on the email for the
same reason, so a lost link is reissued rather than refused. `SETUP_KEY` must be set in the
environment: without it the page refuses rather than letting whoever finds the
URL first claim a freshly deployed system. And the key must match, compared on
its hash in constant time.

It sets no password. It issues the same one-time setup link the script issues
and hands over to `/admin/setup/[token]`, so there is still exactly one screen
in the system where a password is ever chosen.

The account is created with a fixed primary key, `first-admin`. The count
check is a cheap early-out, not the guard: two requests arriving together both
passed it and both created an account, with different emails so no constraint
caught them. The primary key is what makes the second one lose.

## Consequences
A deployment can be completed entirely from a browser, which is what this host
actually supports. The cost is a route that can create an administrator, so it
is tested harder than anything else in the codebase: eight cases covering the
key, the window, the validation, the race and the rate limit.

Two things were found while writing those tests and are fixed here. The rate
limiter did a read and then a write, so two requests from one address raced on
the insert and the loser threw a duplicate key error out of the limiter: a
double click was a 500 rather than a refusal. It is one `INSERT ... ON
DUPLICATE KEY UPDATE` now, the same technique as the invoice sequence. And the
first-run creation itself had the race described above.

`scripts/admin-create.ts` stays. It is still the better route on a host with a
usable shell, and it is what a second admin account is made with, since the
page refuses once one exists.
