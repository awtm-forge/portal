# Runbook

Every admin action, what it does and what it cannot undo, and how to get the
database back if something eats it. Written 9 September 2026, checked against
the code the same day.

Everything here is done signed in at `/admin` on the team hostname. Nothing in
this file needs a terminal except the backup and restore sections.

## The rule that shapes all of it

Evidence is append-only. A sign-off, an issued invoice and a review round have
no update path and no delete path, in the API, in the admin or in a migration.
When something is wrong, the fix is a new row that says so, not an edit that
pretends it never happened. There is exactly one deletion in the system, and
it is a referral, because it holds a third party's details and they never
agreed to be here.

## Actions

**Add a client.** Clients, then Add a client. Saving them mints their link and
shows it once on the handover screen. Nothing is emailed and no project exists
yet: the questionnaire comes first (Q12).

**Send the questionnaire.** On the client, Send the questionnaire, and paste
or choose the JSON document. The first time, this also emails the client their
link. If the email fails, the questionnaire is still on their page and the
link screen says so with a retry.

**Start a project.** On the client, once the questionnaire is in, Start a
project. Ask for the sign-off person here: they are the one the two sign-off
codes reach, and the client's own answer on the questionnaire is offered
first. The project goes on the link the client already has. If their link
never went out, starting the first project sends it.

**The client link.** One per client, for good. Shown once, on the handover
screen, and never again: only its hash is stored. The screen holds it for
fifteen minutes and then it is gone. Losing it is not a problem, rotating is.

**Rotate the link.** Project page, Rotate. The old link stops working on the
next request. Use it when a link went to the wrong person, or when nobody can
find theirs. It emails the new one.

**Replace the questionnaire.** Client, Replace the document. Every failing
rule is reported at once and nothing is saved, so a bad file changes nothing.
Replacing keeps the answers that still have a question to belong to, and
emails nobody.

**Type answers from a call.** Client, Type answers from a call. Each answer is
marked as entered by the team, and that mark is permanent and visible.

**Override an unsubmitted questionnaire.** On the agreement editor, when you
need to send an agreement before they finished. It records who overrode it and
when.

**Write and send the agreement.** Project, Agreement. Internal cost and
internal notes sit in a block marked never shown to the client, and no client
route, print view, export or WhatsApp message has a field they could land in.
Sending increments the version. Editing after they agree is impossible: that
is new work with a new agreement.

**Record a sign-off that arrived on WhatsApp.** Project page, while the phase
is `agreement_sent` for the agreement or `in_review` for the delivery. Paste
what they wrote, give the date and who said it. It writes the same sign-off
event and raises the same invoice as a tap in the portal, with
`method = whatsapp` and the pasted message kept. The two never become
indistinguishable.

**Mark the kickoff done.** Project page, while the phase is `agreed`. This is
what starts the build, and the eight-day silence on the needs-attention block
counts from here.

**Send a weekly update.** Project, Updates. A draft until you send it, frozen
after. `?week=N` opens a particular week.

**Mark the work ready.** Project page, while the phase is `building`. Needs a
link to the finished work. Opens a review round. Rounds are unlimited and
every one is kept.

**Mark an invoice paid.** Project page, on an issued invoice. The date must
read, must not be in the future and must not be before the invoice was raised.
Only the payment fields move; the number and the amounts cannot change.
Marking paid twice is refused.

**Raise an extra invoice.** Project page, Raise an extra. `kind = other` only.
The advance and the balance follow a sign-off and nothing else, and no screen
anywhere can raise them by hand.

**Approve a testimonial.** Project page, on a draft quote, when they said yes
on WhatsApp. Records `approved_method = whatsapp`. A client approving their
own quote on the day-30 page records `portal`. A draft is never used anywhere
outside admin.

**Friction notes.** Project page, day 30 card. Marked ADMIN ONLY in the schema
and there is no client view with a field for them.

**Forget a referral.** Project page, on a referral. The only delete in the
system. Removes the row and writes an event saying it happened, so the fact
survives without the details.

**Close a project.** Project page, day 30 card, while the phase is
`delivered`. Tidies it away. The record stays readable at the same link, which
does not expire.

**Cancel a project.** Project page, Ending it early. Available from any phase
except delivered, closed and already cancelled. The reason is required. It
creates no invoice and changes no issued one: whatever was raised stays
raised, and a refund is a conversation, not a button. The client page says the
project was closed, with the date. There is no way back.

**Settings.** Company details, bank details, invoice prefix, GSTIN, booking
URL, default advance percentage. Fill in the bank details before the first
invoice is printed, or it goes out with no account number on it. The prefix
refuses to change once invoices carry it.

**Add the other admin, or reset a password.** Settings, The team, Add the
other admin. Enter their email and name and it shows a one-time setup link,
once, valid 48 hours. Send it on WhatsApp; they choose their own password when
they open it. Entering an existing address reissues that person's link, which
is the password reset for either of you. Two accounts is the limit. The
`admin:create` script does the same over SSH on a host that will run one.

**The very first admin** on a fresh deployment, when nobody can sign in yet:
`/admin/first-run`, gated on `SETUP_KEY`. It disappears once anyone has a
password.

## When something looks wrong

1. `curl -s https://portal.awtmforge.com/healthz`. `{"status":"ok"}` means the
   node is up and the database answers. `{"status":"degraded"}` with a 503
   means the database does not, and the app is otherwise fine.
2. Every response carries an `x-request-id` header, and the log lines for the
   failures worth chasing carry the same id. Take the id from the browser's
   network tab or from `curl -I`, and search Hostinger's log viewer for it.
3. Logs are JSON, one line each, on stdout. They never contain an answer, a
   code, a token or the body of an email.

## Backups

Hostinger's own backups cover the account. Take our own of the database too,
because a bad migration is not what those are for. Nightly, over SSH or as a
cron entry in hPanel:

```bash
mysqldump --single-transaction --routines --no-tablespaces -u USER -p DBNAME | gzip > ~/backups/awtm-$(date +%F).sql.gz
```

The uploads directory is not in that dump and needs its own:

```bash
tar czf ~/backups/uploads-$(date +%F).tar.gz -C /home/zekst awtm-uploads
```

Keep thirty days:

```bash
find ~/backups -name '*.gz' -mtime +30 -delete
```

## Restoring

Never restore over the live database as a first move. Restore into a scratch
database, look at it, and only then decide.

```bash
mysql -u USER -p -e "CREATE DATABASE awtm_restore CHARACTER SET utf8mb4"
```

```bash
gunzip -c ~/backups/awtm-2026-09-09.sql.gz | mysql -u USER -p awtm_restore
```

Then check the three things that matter, in that database:

```bash
mysql -u USER -p awtm_restore -e "SELECT COUNT(*) FROM SignoffEvent; SELECT COUNT(*) FROM Invoice; SELECT MAX(lastSeq), prefix, fy FROM InvoiceSequence GROUP BY prefix, fy"
```

Sign-off events and invoices are the evidence; the sequence is what stops a
number being handed out twice. If the sequence in the restore is behind what
production already issued, do not point the app at it until the sequence row
is corrected upwards, or the next invoice will reuse a number that exists.

To swap it in, stop the app in hPanel, rename the databases, update
`DATABASE_URL`, start it again, and check `/healthz`.

Uploads restore beside it:

```bash
tar xzf ~/backups/uploads-2026-09-09.tar.gz -C /home/zekst
```

**This has not been rehearsed on the live host.** Do it once, on a day nothing
is happening, and write the date here when you have. Until then, treat this
section as untested.
