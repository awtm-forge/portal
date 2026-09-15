# 26. The team's notices reach WhatsApp through the Cloud API

Accepted, 16 September 2026. Adds a channel to the notifications seam in
ARCHITECTURE.md; changes nothing about what is said or who is told.

## The problem

Ayush: "For every client notification, can we propagate that to the whatsapp
that we have notification from this client."

The team's notices already reach the bell and the team inbox. The team lives
on WhatsApp, and an email about a client's questionnaire is read an hour
later than a WhatsApp would be.

## The decision

A third subscriber beside the email and the bell, sending the same notice to
the team's own number through the WhatsApp Business Cloud API. The sentence
is `teamNotice`'s, the one the bell and the email carry, so the three never
disagree; only the shape changes, to the three parameters of one approved
template: what happened, one line about it, and the link.

A message a business starts outside a live conversation must be a template
Meta has approved, and a template is submitted once and named; the text is
in DEPLOY.md with the setup. The channel is switched on by three values in
the environment and off without them, exactly as SMTP is, and `/healthz`
reports its mode and which values are set, by name.

No client number is ever sent to. The recipient is the team, and the only
number in the configuration is the team's own.

## What this does not do

It does not use an unofficial gateway or a session of the WhatsApp app, which
Meta's terms forbid and which would put the team's own number at risk. It does
not message clients: a client's notices are the bell and email they already
have, and messaging a client on WhatsApp is a thing Rahul does by hand from
the prefilled buttons, as PORTAL-SPEC section 7 describes.

## What it costs

A WhatsApp Business account, a number not already on the app, a system user
with a permanent token, and one template approval, all Meta's to grant and
Ayush's to set up; DEPLOY.md has the steps. Meta charges per conversation a
business starts, a fraction of a rupee for a utility message in India. A
failure is logged with the HTTP status and Meta's error code and nothing else,
because the request carries the token.
