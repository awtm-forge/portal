# 22. A client can be removed while nothing of theirs is evidence

Accepted, 15 September 2026. Narrows nothing in CLAUDE.md section 2, item 5,
and adds the second deletion to the system beside the referral (CLAUDE.md 5.1).

## The problem

There was no way to remove a client. Six were added while the portal was being
tried out, and the honest answer to "delete this one" was that the system
could not, because the rule that protects evidence had been read as a rule
against deleting anything.

Ayush, 15 September: "we should add the details for deleting the client. make
sure there would be authorization before we do that."

## The decision

A client can be removed entirely, by an admin, while nothing of theirs is
evidence: no sign-off event, no invoice, no review round, and so nothing
downstream of those (a testimonial, a day-30 record). Before that point a
client is a link, a questionnaire and at most a project that was never agreed.
After it, the record stays for good and the project is cancelled or closed
instead. The check runs once before and once more inside the transaction, so a
sign-off landing between the two wins.

Everything else of theirs goes with them: projects that were never agreed,
their agreement drafts, the questionnaire with its versions and change
requests, uploads on disk, sessions, codes and notifications, and the activity
events of the removed projects. What survives is one `client.removed` activity
event carrying the business name, how many projects went with it, who did it
and why. No contact detail.

Authorization is the acting admin proving it is them: the client's business
name typed, a reason, and their own password entered again, checked with the
same bcrypt compare as the login and limited to five tries in fifteen minutes
per admin. The password is checked last, so a typo in the name spends nothing.

## Why the append-only guard does not bend

`IntakeVersion`, `IntakeChangeRequest` and `AgreementNote` are in the guard,
and a client being removed may have all three. They are append-only because a
living record must not be rewritten: a version of what the client told us, or a
note they left on an unsigned agreement, must never be edited into something
else. Removing the whole client is not rewriting the record; it is the record
ceasing to exist, and once it has there is nothing for those rows to be
evidence of.

So the removal clears those three tables by name, in raw SQL, inside its own
transaction, after the evidence check. The guard on model operations is
untouched and `tests/append-only.test.ts` says so: a delete on any of the three
through the wrapper still throws. Raw SQL is the honest way to write "this one
path, deliberately", rather than a flag on the guard that any later caller
could set.

## What it costs

A removed client cannot be brought back. The team has the line in the log and
nothing else, which is the point: a client added by mistake, or one who asked
to be forgotten before anything was agreed, leaves no trace of their details.

The evidence rule is unchanged in every direction. A client with a sign-off,
an invoice or a review round cannot be removed by anyone, through any screen,
and the page says what stands in the way rather than offering a button.
