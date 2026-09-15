# 21. A client link can be read back and sent again

Accepted, 14 September 2026. Amends ADR 0015 and PORTAL-SPEC 5.9.

## The problem

Only a hash of a client's access token was stored. That is right for a
password and wrong for this, and the difference showed up the first time Rahul
needed to send somebody their link a second time.

The link is not a password. It is an address we gave a client for their own
page. A client loses it in a chat thread, changes phone, or asks for it again
six weeks later, and the honest answer the system could give was: it cannot be
shown, rotate to make a new one. Rotating stops the old link working the moment
it runs, so the fix for our problem takes away the thing the client already
has, and any bookmark or pinned message they kept.

## The decision

Keep a second copy of the same token beside the hash, encrypted rather than
hashed, under a key derived from `SESSION_SECRET`. `Client.accessTokenSealed`,
AES-256-GCM, a fresh nonce per value, the tag checked on the way back.

The hash stays and stays authoritative: every sign-in still compares hashes and
nothing reads the sealed copy to authenticate. The sealed copy exists for one
screen, the client's link page, where a signed-in admin can see the link the
client holds and send it again without changing it.

## What this is and is not worth

The key lives in the environment and never in the database, so a database dump
on its own reveals nothing. That is the whole of the protection, and it is
worth saying plainly: anyone holding both the dump and the environment holds
every client link. Before this change they would have held none of them.

That is the trade, taken deliberately. The alternative was a team that cannot
do an ordinary thing, and a workaround (rotate and re-send) that costs the
client something every time.

A link still grants only what it always granted: that client's own pages,
which they are entitled to see. It is not a password, it grants nothing to any
other client, and signing off anything still needs a fresh six-digit code to
the sign-off person's email, which this does not touch.

## What it costs

One nullable column and a migration. Links minted before this change were
never captured, and on 14 September the page told the team to rotate to get one
it could show, which takes away a working link to solve a display problem.
Amended the next day, below.

Rotating `SESSION_SECRET` makes every sealed copy unreadable. Nothing breaks
and nobody is locked out, because the hashes are untouched; the link page falls
back to saying the link cannot be shown. That is worth knowing before anyone
rotates the secret.

The sealed value is never logged, never put in the flash cookie, which the
browser can read, and never sent in an email. It is rendered on one page,
behind an admin session.

## Amended 15 September 2026: old links are not lost to the page

Ayush: the link should be available every time, for every client. Two ways an
old link becomes one the page can show, and neither rotates anything.

The first is automatic. A client's plain token arrives in every request they
make with their link, so `clientByToken` keeps a sealed copy the first time it
sees a client with none. One update, once, and a failure to write it is logged
and never stands in the way of the visit. Nothing about authentication changes:
the hash is still what is compared.

The second is the team pasting the link from their sent mail or a WhatsApp
thread. `keepClientToken` takes whatever was pasted, pulls the token out of it,
hashes it and compares in constant time with the hash held for that client;
only a match is kept. A wrong paste, or another client's link, keeps nothing
and says so.

Rotating stays on the page as the last resort, outlined and under a line that
says what it costs, for the case it was always for: a link that went somewhere
it should not have.
