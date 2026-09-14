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

One nullable column and a migration. Links minted before this change were never
captured and cannot be recovered, so that page keeps saying so for them; a
rotation is what gives those clients a link the page can show.

Rotating `SESSION_SECRET` makes every sealed copy unreadable. Nothing breaks
and nobody is locked out, because the hashes are untouched; the link page falls
back to saying the link cannot be shown. That is worth knowing before anyone
rotates the secret.

The sealed value is never logged, never put in the flash cookie, which the
browser can read, and never sent in an email. It is rendered on one page,
behind an admin session.
