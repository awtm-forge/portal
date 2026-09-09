# Questions for Rahul

Written by the build session when the specs and `CLAUDE.md` do not settle something. Each entry has the question, the options with what each costs, and the option being taken meanwhile so the build does not stall. Answer in place: edit the entry, write "Decided:" and the choice. The build re-reads this file at every step and follows a decision from the next step onward.

Nothing here is a credential question. Those stop the build instead, per `CLAUDE.md` §6.

---

## Q1. Rounding the advance when the split does not divide evenly

Open, 7 Sep 2026. Needed by step 5.

`total_paise × advance_pct` is rarely a whole number of paise. Two invoices must add up to the total exactly, since a client will check.

- **Round the advance down, balance is total minus advance.** The balance absorbs the remainder, at most one paisa. Costs nothing.
- **Round the advance to the nearest rupee.** Prettier advance figure, balance carries an odd remainder up to 99 paise.
- **Round both and let the total drift.** Refused: the two invoices would not sum to the agreement.

Taking the first. The arithmetic lives in `lib/money` with a test that the two invoices always sum to the total, for a hundred percentages and totals.

## Q2. Where the project-level timeline and outcome fields are edited

Open, 7 Sep 2026. Needed by step 5.

PORTAL-SPEC §4 puts `week_count` ("week 4 of 8"), `metric_name`, `metric_baseline_value`, `after_delivery` and the retainer or handover fields on `project`, but no screen in §6 says where they are typed. They are all known at the moment the agreement is written.

- **Edit them in the agreement editor, in a block below the money.** One screen holds everything decided at that moment. The fields are written to `project` when the agreement is saved. Costs nothing extra.
- **A separate project settings screen.** A second place to look, and a second place to forget.

Taking the first. `metric_baseline_value` is prefilled from the intake answer `mk_metric_now` when that key was answered, and stays editable.

## Q3. Who can open the printable agreement

Open, 7 Sep 2026. Needed by step 5.

PORTAL-SPEC §3.1 says the printable routes need "auth or token required" without saying which for which.

- **Both: the holder of a project's link can print that project's agreement, admin can print any.** The client can save their own copy without asking, which is the point of the document. The route takes the token in the path for the client and the session for admin.
- **Admin only.** The client would have to ask for a PDF, which puts the team back in the loop the portal exists to remove.

Taking the first. Neither shape carries internal cost, and the leak-walk test covers both.

## Q4. Whether the sign-off person belongs to the client or to the project

Decided by Rahul on 8 Sep 2026: **on the project**.

PORTAL-SPEC section 4 puts `signoff_person_name` and `signoff_person_email` on
`client`. They are now on `project`, because one business can have a different
approver for a brand job than for a store rebuild, and the six digit code has
to reach the person who is actually agreeing this piece of work.

What it cost: a migration that copied every existing project's approver across
before dropping the client columns, and the questionnaire's proposed-change
prompt moving to the project too. What it buys: a second project for the same
client does not silently inherit the wrong approver.

## Q5. The referral is one field in the brief and two columns in the schema

Decided while building, 8 Sep 2026. Taking two fields, name and contact, rather than one.

CLAUDE.md 5.1 describes "a referral field, their name and how to reach them" as one box; PORTAL-SPEC 4 has never had the table at all. Two inputs, both required if either is filled, because parsing "Priya, 98860 11234" back into a name and a number later is worse than asking now, and because a name with no way to reach them is a third party's details stored for no purpose.

Say the word if you would rather it were one box and we will join them.

## Q6. Rate limits are shared across the three kinds of code

Open, 8 Sep 2026. Not changed.

The limit is eight code requests per project per ten minutes, counted across login, agreement and delivery together. A client who fumbled a login earlier in the session could, in theory, hit it on the sign-off screen, which is the highest-stakes moment in the journey.

- **Leave it.** One counter, easy to reason about, and the copy already tells them to message Rahul. In practice eight requests in ten minutes is a lot of fumbling.
- **Count each purpose separately.** A sign-off is never blocked by an earlier login attempt. Three counters instead of one, and a small widening of what an attacker can ask for.

Leaving it, and noting it here because it is foreseeable rather than unlikely.

## Q7. What tax rate an invoice charges once a GSTIN exists

Open, 8 Sep 2026. Taking zero for now, which is what the spec says today.

PORTAL-SPEC 5.8 says render tax lines only when `company.gstin` is set, and until then `tax_amount_paise = 0`. It never says what rate to charge once it is set. The column exists, the print page shows a tax line the moment a GSTIN appears, and `issue()` writes zero regardless, so today a registered GSTIN would print a tax line reading zero, which is wrong on a real invoice.

- **Leave it at zero and set the rate when you register.** Nothing to decide now. The risk is that the day the GSTIN goes into settings, invoices quietly go out understating tax.
- **Add `company.gst_rate_pct`, defaulted to 18.** One settings field, one line in `issue()`. Software services are 18 percent, but whether you charge CGST plus SGST or IGST depends on where the client is, and that is a second field on the client and a rule about place of supply.
- **Refuse to issue while a GSTIN is set and no rate is.** Safest, and it stops the build if you register mid-project.

Taking the first, because you are not registered and the spec is explicit about the current state. Worth deciding before you register rather than after.

## Q8. Bank details are empty, so a printed invoice has nowhere to pay it

Open, 8 Sep 2026. Not blocking, and now visible in admin.

CLAUDE.md 5 seeds the company row with a name, a city, a prefix and an advance percentage, and no bank details. PORTAL-SPEC 6.7 says the printed invoice carries them. The document hides the "How to pay" block when there is nothing to show rather than printing empty labels, so the invoice is still valid, but it tells the client nothing about where to send the money.

Fill in account name, bank, account number and IFSC, or a UPI id, at `/admin/settings`. Until one of those exists the admin invoice list says so. Nothing to decide, only something to do, and it belongs to you rather than to the build because it is our own detail and not a credential.

## Q9. The day-30 box shows the client a draft testimonial, which criterion 26 forbids

Decided while building, 9 Sep 2026. Taking the prefill, and narrowing the criterion.

Acceptance criterion 26 says a testimonial with `status = draft` never appears outside `/admin/`. CLAUDE.md 5.1 says the day-30 draft is prefilled from the delivery quote "so the client edits rather than starts again". Both cannot be true: the delivery quote is a draft until day 30, and the day-30 box is a client page.

- **Prefill, and narrow the criterion.** A draft appears in exactly one place outside admin: the day-30 box of the project it belongs to, shown to the signed-in client who wrote it. Showing someone their own words back is not what criterion 26 guards against, which is a quote being used before its author approved it.
- **Do not prefill.** Criterion 26 stays literal, and a client who wrote a good line on delivery day types it again a month later, or more likely does not.

Taking the first, because CLAUDE.md 5.1 is a decision of yours that postdates the criterion, and 5.1 wins under CLAUDE.md 1. The code enforces it narrowly: `draftTextForClient` returns the text and nothing else, no status, no dates, no method, and there is still no client serializer for a testimonial. A draft belonging to any other project cannot reach any client page, and there is a test for exactly that.

Worth rewording criterion 26 in PORTAL-SPEC to say what it means: an unapproved quote is never used anywhere it could be read as an endorsement.

## Q10. Criterion 13 says "exactly one primary action above the fold", and three pages have none

Found while automating the check, 9 Sep 2026. Testing "never more than one" instead.

Criterion 13 and CLAUDE.md 2 item 9 both say every client page shows exactly one primary action above the fold on a 375px screen. Measured against the real pages, three have none, and each for a reason worth keeping:

- **While building** there is nothing for the client to do. They read the week's update. Adding a button would be inventing work.
- **The agreement** puts "I agree" after the document, not before it. Agreeing to something you have not scrolled through is the thing the whole design is against.
- **The review** does the same with the sign-off.

The pages that do ask for something, the thank-you page and day 30, have exactly one and it is on the first screen. Both halves are now tested.

- **Reword it to "never more than one".** What the rule was reaching for, and what the code does.
- **Keep "exactly one" and add buttons.** Three buttons that exist to satisfy a sentence.

Taking the first. Worth changing the wording in PORTAL-SPEC and CLAUDE.md so the next person does not read the code as broken.

## Q11. The client portal was built for a 375px screen, and people use it on the web

Decided by Rahul on 9 Sep 2026: **it is a web product, and it has to work on a desktop.**

CLAUDE.md 2 item 9 and criterion 13 are both written as "on a 375px screen", and every client page was capped at a 480px column. On a laptop that left each one as a narrow ribbon down the middle of the window with the header bar floating inside it, and the questionnaire three and a half thousand pixels tall with its option lists stacked one per row.

The one-thing-to-do rule is not what changed. It is about attention, not width: one column of decisions, no navigation, no tabs, and never more than one loud button in the first screenful. That still holds, and it is now tested at both widths rather than only at 375.

What changed is that 480px stopped being the width of the page and became the measure of its prose. The shell spans the window, the measure grows with the viewport, and repeated controls spread out when there is room: the questionnaire's option lists go four across at 1440 and the page lost five hundred pixels of height. The questionnaire gets a wider measure than the rest, because it is a form and a form wants more room than an article.

Two lines in the specs are now out of step and are yours to reword: CLAUDE.md 2 item 9, and criterion 13. Both should say "at any width" rather than naming a phone. Criterion 20, which compares the portal to a marketing site that is no longer deployed, was already waiting for the same treatment.

## Q12. The questionnaire comes before the project, not after it

Asked by Rahul on 9 Sep 2026: "questionnaire should not be followed by project. Once client is created questionnaire can be sent."

Today a questionnaire hangs off a project, so to send one you must first invent a project: a name and a type of work, at the moment in the relationship when you know least. PORTAL-SPEC section 4 puts `intake` on `project` and the client link on `project` too, so this is a departure from the spec, not a gap in it.

The questionnaire itself argues for the change. Its five sections are Your business, What is going wrong, What it should look like, Who decides, and Access. Every one is about the business, not about a piece of work. It is discovery, and discovery happens before there is a project to name.

- **Move the questionnaire and the link to the client.** One client, one questionnaire, one link that never expires, and projects appear on that link as they start. Matches how the work is actually sold, and matches what the portal footer already promises: "This page is yours and the link does not expire." Costs the most: the link and the session are keyed to a project today, so this touches the sixteen files that resolve a token, the twenty-one routes under `/p/`, the sign-off flows, and every end to end spec.
- **Create the project silently when the questionnaire is sent.** Small, a day. The project gets a placeholder name until it is renamed. Rejected: the templates drop the project name straight into a sentence, so the client receives "Thank you for trusting us with solution", which Rahul saw happen on 9 September with exactly this shortcut. It would ship that permanently.
- **Leave it.** Rejected: it is the friction he asked to remove.

Taking the first. The second is faster and produces a worse product for a client to read, which is the wrong trade for a feature whose whole purpose is the client's first impression.

Built on 10 Sep 2026, ADR 0015. Rahul added on 9 Sep that saving the client should generate the link first and the questionnaire second, which is how it works: save the client, see their link once, send the questionnaire, which emails it.

Four things decided while building, none of which the specs answer:

- A client whose questionnaire is in and whose project has not started sees "Got it, thank you", with what they told us folded away and nothing to do.
- The questionnaire is asked once per client. A second project starts past the gate.
- The login code goes to the client's contact email, because there may be no project and no sign-off person yet. The two sign-off codes still go to the project's sign-off person.
- A client's page shows their newest live project, and when none is live, the newest there was. The first cut hid a closed project, which broke "closed: the record, read-only" in PORTAL-SPEC 6.1, and the day-30 test caught it.

## Q13. The way back a section on the questionnaire

Asked by Ayush on 10 Sep 2026, filling the questionnaire on production: "in client portal there is no going back to backward page."

INTAKE-SPEC section 11 says one section is open at a time and one button sits at the bottom of it, "Save and carry on". The way back was there, tapping the title of a finished section reopens it, and nothing on the page said so. A client who carried on one section too early had no move they could see.

- **A quiet Back under the button, on every section after the first.** The same weight as Skip on the thank-you page and "Something is off" on the agreement: a text control, not a filled button, so criterion 13 still counts one primary action (Q10). Costs one line per section and a small style. Nothing is saved or unsaved by it; answers save as they are typed and a finished section stays finished.
- **Make the titles look tappable, with a "Change" tag on finished sections.** Rejected: the spec fixes the collapsed state at three words, done, now and later, and a tag on the record is a hint where the action should be a word.
- **Leave it.** Rejected: it was found by the second person to fill one in.

Taking the first. Built the same day, with an end to end test at both widths. The titles stay tappable as well.
