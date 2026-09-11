# 06. Decision log

Kept as the work goes, newest at the bottom. One line each: what was decided, why, what it cost. Dates are 2026. AI-assisted.

| When | Decision | Why | Cost |
|---|---|---|---|
| 11 Sep, Phase 0 | Audit on a fresh production build on port 3210 with the log mailer and the Docker database; never the dev server, never production | The dev server rewrites `.next` while a build runs and corrupted the route types once already; production data is never touched by local work | One extra build per audit pass |
| 11 Sep, Phase 0 | One theme in the audit set (the app is dark only by the 5 Sep decision); three widths, 390, 768, 1440 | A light theme does not exist; adding one is new scope | Nothing |
| 11 Sep, Phase 0 | Screenshots come from one script, `scripts/ux-audit/shoot.ts`, that walks every state by moving the seed project through its phases and putting it back | The after set must be the same frames as the before set, taken the same way, or the comparison lies | The script is 200 lines the product does not need; it lives under `scripts/ux-audit/` |
| 11 Sep, Phase 0 | Lighthouse runs from the npx cache (`lighthouse@12.8.2`), not as a dependency | A one-off measuring tool does not belong in `package.json` | The first run downloads it |
| 11 Sep, Phase 0 | The audit server logs to a file, not to the harness pipe | A background task's stderr pipe was closed under it, every log write threw EPIPE, Next logged the throw, and the process spun at 99 percent CPU. Not the app's fault, but it cost forty minutes | Nothing |
| 11 Sep, Phase 0 | Friction numbers F-01 to F-37 are frozen once written | Later documents cite them | Nothing |
