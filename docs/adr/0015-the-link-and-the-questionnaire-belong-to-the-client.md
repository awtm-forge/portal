# ADR 0015: the link and the questionnaire belong to the client

## Status
Accepted, 10 Sep 2026

## Context
PORTAL-SPEC section 4 puts `intake` on `project` and the client link on
`project`. To send a questionnaire you had to invent a project first: a name
and a type of work, at the moment in the relationship when you know least.

Rahul, 9 September: "questionnaire should not be followed by project. Once
client is created questionnaire can be sent", and "after saving the client
there should be link generation for the client and then questionnaire".

The questionnaire itself argues for it. Its five sections are Your business,
What is going wrong, What it should look like, Who decides, and Access. Every
one is about the business, not about a piece of work. It is discovery, and
discovery happens before there is a project to name.

## Decision
The client owns the link, the sessions, the login code, the questionnaire and
its uploaded files. A project owns none of them. `QUESTIONS.md` Q12.

- Saving a client mints their link and shows it once on a handover screen,
  exactly as the project handover worked. Nothing is emailed and nothing is
  started.
- "Send the questionnaire" attaches the document to the client and, the first
  time, emails the link. A replacement later attaches quietly.
- Starting a project puts it on the link the client already has. It mints no
  link. If the questionnaire is already in, the project starts past the gate,
  at `agreement_draft`.
- The login code goes to the client's contact email, because a client can be
  signed in before any project exists. The two sign-off codes still carry the
  project and go to its sign-off person, who is named on the questionnaire
  and held on the client until there is a project to put them on.
- The questionnaire is asked once per client, not again for a second project.
- A client's page shows their newest live project, and when none is live, the
  newest there was: a closed project stays readable at the same link, which
  PORTAL-SPEC 6.1 requires and the first cut of this change broke.

The migration adds the client's columns, backfills each from that client's
earliest project, and only then drops the project's. Prisma's generated diff
would have dropped and re-added, orphaning every row.

## Consequences
One link per client for good, which is what the portal footer already
promised. The client zone keeps its paths; the token resolves a client and one
helper picks the project, so twenty-one routes changed the same way. The
admin's questionnaire and handover screens moved under the client. Criterion
22 reads "sending the questionnaire, or starting the first project, emails the
link once" rather than "creating a project sends one email".

Two things it does not do: a client with two live projects at once sees the
newer one, and the older is reachable only through admin; and PORTAL-SPEC
section 4 is now out of step with the schema on this point, which is Rahul's
to reword.
