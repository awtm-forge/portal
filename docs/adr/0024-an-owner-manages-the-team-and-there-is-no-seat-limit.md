# 24. An owner manages the team, and there is no seat limit

Accepted, 15 September 2026. Amends PORTAL-SPEC 6.6 (two admins) and the
CLAUDE.md section 5 default that both admins have the same permissions.

## The problem

Ayush: "sign in process is bit of hassle right now. I am thinking there
should be one super admin in this case that is Ayush who can add new admin.
there is no boundation for number of admins."

Two things were true and both got in the way. The limit of two seats, which
made sense for two founders and nobody else, met every attempt to widen the
team. And every admin could add or remove admins, so there was no one person
whose job it was.

## The decision

There is no seat limit. The owner adds as many admins as needed, reissues
their setup links, resets their passwords, and takes access away. Everyone
else sees the team on the settings page and nothing to press, with a line
naming who to ask.

The owner is named by `OWNER_EMAIL` in the environment, the address they sign
in with, rather than by a column. It is a deployment fact: Ayush holds the
hosting, it needs no migration, and nothing inside the app can change it.
While it is unset, every admin can manage the team, which is how the two
founders started, and `/healthz` reports `admins.owner: false` so the gap is
visible from outside.

Taking access away keeps the row. An admin who uploaded a questionnaire or
decided a change request is pointed at by those rows, and deleting them would
either fail or lose the record of who did what. So `removeAdminAccess` clears
the password, the setup link and every session, and stamps `accessRemovedAt`;
the seat reads "access removed" and a reissue from the owner gives it back.
Nobody removes their own access, and nobody removes the owner's.

## What it costs

One nullable column. An `OWNER_EMAIL` to set once in hPanel, and to change if
the owner ever does; DEPLOY.md has the line. Until it is set, the guard is not
there, which is the same state the portal was in before this decision.

The setup flow itself is unchanged: a link, shown once, and the person chooses
their own password. Nothing here starts setting passwords for people.
