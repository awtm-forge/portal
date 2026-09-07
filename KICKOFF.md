# Kickoff

How to start, once, on 7 Sep 2026 or later.

1. Open Claude Code in `/Users/zekst/work/funnel`. That folder is the repo; the specs, `CLAUDE.md`, `docs/`, `reference/` and `image-library/` are already in it, and Claude Code reads `CLAUDE.md` automatically at the start of every session.
2. Paste the message below as the first message of a fresh session. Nothing else is needed after it until the build reaches deployment. (The session already running on 7 Sep 2026 gets the re-read message at the end of this file instead.)

---

Read CLAUDE.md completely, then PORTAL-SPEC.md and INTAKE-SPEC.md completely, then docs/ARCHITECTURE.md, docs/DATA-MODEL.md, docs/DFD.md and docs/SEQUENCES.md, before doing anything else. CLAUDE.md is your standing brief for this whole job and it answers most questions you will have; the two specs are the source of truth for behaviour; the docs folder is the design you build to and keep true.

Then, in your first reply, give me only this: which of the build order steps 1 to 4 the existing code already covers and what in it differs from CLAUDE.md §11; any conflict you found between the specs and CLAUDE.md, quoted; and confirmation that MySQL is reachable locally. No plan beyond that, no code yet.

Then start at the first unfinished step of the build order in PORTAL-SPEC §9 and keep going, step after step, in the loop described in CLAUDE.md §3, reporting after each step in the format in §7. Do not wait for me between steps. Do not ask me anything that CLAUDE.md §5 already decides; put every other question in QUESTIONS.md with your chosen default and continue. Stop only at the deployment boundary in CLAUDE.md §6, with DEPLOY.md written for Ayush.

Non-negotiables in CLAUDE.md §2 apply to every commit. Money in paise, internal cost never on a client route with the test written early, no field anywhere that could hold a client's credential, no live key of ours anywhere, no em dashes.

Create BUILD-LOG.md, QUESTIONS.md and CHANGELOG.md before the first commit.

---

When a new session starts later (after a restart or a compaction), paste this instead:

Read CLAUDE.md, then BUILD-LOG.md, then QUESTIONS.md. Continue from the first unfinished step in the build order. Report in the CLAUDE.md §7 format after each step and do not wait for me between steps.

---

When Ayush has deployed, paste this:

Deployed on awtmforge.com. Run the production checks in CLAUDE.md §6, fix what fails, and give me the final report.

---

For the session that was already running when the brief changed (7 Sep 2026), paste this instead of the first message:

CLAUDE.md and a new docs folder have changed since you started, and the old root README has moved to docs/HANDOVER.md. Re-read CLAUDE.md fully, then docs/ARCHITECTURE.md, docs/DATA-MODEL.md, docs/DFD.md, docs/SEQUENCES.md and the ADRs in docs/adr. Three things are new: §5.1, four decisions from Rahul's flow diagram; §11, the architecture the code must follow from here; §12, the documentation set kept true in the same commit as the code. Create BUILD-LOG.md, QUESTIONS.md and CHANGELOG.md now. In BUILD-LOG.md, record steps 1 to 4 as built, list where the front half differs from §11 and §5.1, and fold each difference into the next step that touches that area rather than reworking now. Write the repo README.md as §12 describes. Then continue from step 5, reporting after each step in the §7 format, without waiting for me.
