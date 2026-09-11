# ADR 0018: a one-shot cookie carries the confirmation toast

## Status
Accepted, 11 Sep 2026

## Context
Every admin action ends with `refreshTo(path)`: revalidate and redirect. The
page re-renders with the change in it, and nothing says "that worked". Marking
an invoice paid, saving notes, recording a sign-off, freeing an admin seat: the
UX audit (docs/ux-overhaul, F-30) found the team re-reading the page after
each one to check. Settings alone confirmed itself, with `?saved=1` in the
URL, which repeated on reload and on the back button.

The App Router cannot change a cookie during a render, only in a server action
or route handler. So a flash message set by the action cannot be cleared by
the page that shows it, which rules out the classic server-side flash. A URL
flag repeats. Client state does not survive the redirect.

## Decision
A server action that wants a confirmation calls `refreshWith(path, message)`,
which sets a short-lived cookie `awtm_flash` (not httpOnly, `sameSite=lax`,
sixty seconds, path `/`) and then refreshes as before. Both shells mount one
`<Toast>` client component, which on mount reads the cookie, clears it itself,
and shows the sentence for four seconds in a `role="status"` live region. The
cookie is readable by the page on purpose; by contract in `src/lib/flash.ts`
it only ever carries a sentence such as "Marked paid", never anything private.

## Consequences
Every action confirms itself with one line and no page-specific code. A
refusal that happens after a confirm dialog has closed (cancel, rotate) can be
reported the same way. The cost: one more cookie, readable by script, so the
rule that it holds nothing private has to hold; and a message set within sixty
seconds of a navigation that never mounts a shell (a print route, say) is
dropped, which is acceptable for a confirmation.
