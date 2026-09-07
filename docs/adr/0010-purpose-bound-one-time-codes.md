# ADR 0010: one-time codes carry a purpose, and only a login code opens a session

## Status
Accepted, 7 Sep 2026

## Context
ADR 0003 gave clients a link plus a six-digit code. PORTAL-SPEC 5.10 then asks
for something stronger at the two sign-offs: a fresh code even inside a valid
session, because that is what makes a sign-off attributable to a person at a
moment rather than to whoever holds the phone. With one undifferentiated kind
of code, a code requested to sign in could be replayed to agree, and a code
requested to agree would silently extend the session.

## Decision
`one_time_code.purpose` is an enum of `login`, `agreement` and `delivery`.
Requesting a code retires the outstanding codes of that purpose only, and
verification matches on the purpose as well as the digits. A `login` code sets
the thirty-day session cookie; an `agreement` or `delivery` code proves who is
tapping and sets nothing.

## Consequences
The two sign-offs cannot be reached with a code obtained for anything else, and
a sign-off does not lengthen a session as a side effect. The cost is one column
and a purpose argument on two functions. The rate limits are per project and
per IP across all purposes, so a client who asks for many codes of one kind is
slowed on the others too, which is the safer way round.
