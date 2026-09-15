# 23. The portal is in rehearsal until the team says it is live

Accepted, 15 September 2026. Sits beside ADR 0022 and reads CLAUDE.md section
2, item 5, as a rule about real clients.

## The problem

Six clients were added to try the portal out, and some of them signed off and
were invoiced. ADR 0022 lets a client be removed while nothing of theirs is
evidence, so those could not be removed, which is the evidence rule holding on
test data. The answer offered first was a wipe by hand over SSH, which Ayush
declined: "i am not doing all that". The test invoices also hold numbers in
this year's sequence, and the app never reuses a number, so the first real
client would have started at whatever the testing left.

## The decision

Until the team says the portal is live, everything in it counts as rehearsal.
In rehearsal, one control on the settings page, Start clean, erases every
client and everything that ever happened to them in one transaction and starts
the invoice numbering again at 0001. Kept: admin accounts and their sessions,
the company row, settings, the image library and the migration ledger; the
client uploads on disk go too, the library beside them stays.

Saying the portal is live is a second control on the same page, one way: a
`live_since` key in the `Setting` table, the first use of that table, written
once and never moved. After it, Start clean is gone from the page and the
module refuses even if asked, and the evidence rules hold in full.

Both controls need the acting admin's own password again (ADR 0022's
`reauthenticateAdmin`, five tries in fifteen minutes). Start clean also needs
the phrase "erase every client" typed and a reason in a line, which survives
in the one activity event that does: `system.started_clean`, with the counts,
who and why.

## Why this is not the rule bending

The rule says a sign-off, an issued invoice and a review round have no delete
path, not in the API, not in the admin, not in a migration. It exists so that
what a real client agreed to and was billed for can never be edited away. A
rehearsal has no real clients; its sign-offs are the team tapping through
their own screens. Ending the rehearsal by erasing it whole is not a delete
path for evidence; it is the moment before there is any.

The wipe is raw SQL by design, outside the model guard. The guard exists so
that nothing that reads like ordinary code can delete those rows, and that is
still true: `tests/append-only.test.ts` still refuses every model delete, and
the wipe is one function, in one file, named for what it is, that refuses the
moment `live_since` exists.

## What it costs

The switch has to be thrown. Until it is, an admin with their password can
erase everything, so the settings card says so in its first line and the
health check reports `live: false` for as long as that is true. The day the
first real client is in, marking the portal live is the last rehearsal step,
and the runbook says so.

The wipe is tested inside a transaction that is rolled back on purpose, so
the suite proves the statements run in order and leave every client-shaped
table empty and every kept table whole, without ever erasing the fixtures it
runs on. The end-to-end spec walks the gate and the switch, not the wipe.
