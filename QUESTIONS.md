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
