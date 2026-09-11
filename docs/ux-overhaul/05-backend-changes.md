# 05. Backend changes

What changed below the view layer to make the flows work, with the reason each was needed. Nothing here adds a table, a phase or a route; nothing touches auth, validation or rate limits. Dates are 2026. AI-assisted.

| Change | Where | Why | Notes |
|---|---|---|---|
| `pendingTask` returns null for `CANCELLED` and `CLOSED` before any other check | `src/components/portal/Journey.tsx` | D-01: a cancelled project with an unlocked day-30 row showed the check-in task and no closed line | Pure function; unit test `tests/journey.test.ts` pins every phase |
| `standingStatus` takes `endedOn` for the cancelled line | same | PORTAL-SPEC §6.1 and CLAUDE.md §5: "This project was closed on [date]" | The reason stays ours: never passed to the client |
| `waitingOn(facts)` and `WAITING_LABEL` | `src/modules/projects/waiting.ts` | F-20: the dashboard and the project page say who each project is waiting on, for what, since when, from facts already on the record | Pure; `listForAdmin` now includes `agreement`, the last sent update, the open round and `day30` so the dashboard needs no extra queries per row |
| `tellDay30Due(clientId)` and `DAY30_DUE` | `src/modules/notifications/client.ts` | F-16: nothing told the client the month-on page had opened; there is no scheduler by design, so the client home writes the notice once on the first render after the unlock | Idempotent on `kind = "day30.due"` per client; a race between two first renders could double it, harmless. Emails through the same plain-text path as the other notices |
| `tellClient` and `tellDay30Due` share `deliver()` | same | one place that writes the row and sends the mail | No behaviour change for the event-driven notices |
| `listForClient(clientId, take)` is read with `take = 400` by the updates page | `src/app/p/[token]/updates/page.tsx` | F-14: the page groups by day, shows sixty and folds the rest | The default of 30 is unchanged for other callers |
| `flash(message)` and `refreshWith(path, message)` | `src/lib/flash.ts`, `src/lib/admin-nav.ts` | F-30: every admin action confirms itself with a toast; the cookie is readable by the page because a render cannot clear a cookie, so it only ever carries a sentence like "Marked paid" | `refreshWith` returns `Promise<never>`; actions that return a form state `return` it so TypeScript sees the function end |
| `cancelProjectAction(formData)` replaces the `useActionState` shape | `src/app/admin/(app)/projects/[id]/day30/actions.ts` | F-24: cancelling lives in a confirm dialog with the required reason; a refusal arrives as a toast because the dialog has closed by then | `CancelProject.tsx` deleted |
| Settings no longer redirect with `?saved=1` | `src/app/admin/(app)/settings/actions.ts`, `page.tsx`, `SettingsForm.tsx` | the toast replaces the query flag | |
| Newsreader loads upright only, no optical-size axis | `src/app/layout.tsx` | 03-baseline-metrics.md: 273 KB of font on the critical path for a style nothing used | Bricolage keeps its axis: the marketing site sets `opsz` |
| `<dl class="pairs">` wraps each pair in a `div.pair` | `src/components/portal/AgreementDocument.tsx` | axe `definition-list` and `dlitem` failures on the agreement page | `display: contents` keeps the grid |
| Questionnaire autosave treats a 401 as "signed out" | `src/components/intake/IntakeRenderer.tsx` | F-06: the old message blamed the connection | Client-side only; the API is unchanged |

## Serialisation check

Nothing in this overhaul adds a field to a client view. The end-to-end suite gains an API-level assertion (`tests/e2e/leak-walk.spec.ts`) that fetches every `/p/` page and the questionnaire API as the client and asserts the seeded internal cost and internal notes never appear in a response body, not only in the rendered template.
