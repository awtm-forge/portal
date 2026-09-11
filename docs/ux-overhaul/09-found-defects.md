# 09. Defects found on the way

Bugs, not friction: behaviour that is wrong by the specs. Each says whether it was fixed in this overhaul or left, and why. Dates are 2026. AI-assisted.

| # | Found | Where | What | Status |
|---|---|---|---|---|
| D-01 | 11 Sep, Phase 0 walk | client home, `src/app/p/[token]/page.tsx` and `pendingTask` in `src/components/portal/Journey.tsx` | A cancelled project with an unlocked day-30 row still shows the "month-on check-in" task and no "This project was closed on [date]" line; `pendingTask` checks the day-30 flag before the phase. PORTAL-SPEC §6.1 and CLAUDE.md §5 both say the closed line is the whole page. | fixed in Phase 2 (client journey) |
| D-02 | 11 Sep, Phase 0 | admin shell at widths under 900 px, `src/components/admin/AdminShell.tsx` | The stylesheet turns the nav into a row on small screens, but an inline `flexDirection: "column"` on the same element wins, so phones get a vertical nav beside the wordmark (friction F-21). | fixed in Phase 2 (admin journey) |
| D-03 | 11 Sep, Phase 0 | audit environment only | Running `next start` as a harness background task: the task's stderr pipe was closed while the server ran, every log write raised EPIPE, Next's `uncaughtException` handler logged that with `console.error`, which raised again, and the process spun at 99 percent CPU while answering nothing. Not reachable in production, where stdout and stderr go to the host's log. | not a product defect; recorded so nobody chases it again |
