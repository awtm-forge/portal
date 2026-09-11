# 03. Baseline metrics

Lighthouse 12.8.2 on 11 Sep 2026 against the local production build (port 3210, local database), signed in with planted sessions (`scripts/ux-audit/lighthouse.ts`). Client screens under the default mobile profile (Moto G Power emulation, 4x CPU slowdown, slow 4G); admin screens under the desktop preset, which is where the team uses them. Performance, accessibility and best practices only; SEO is meaningless on noindex routes. The per-screen JSON was read and discarded; `audit/lighthouse-before/summary.json` keeps the numbers. AI-assisted.

## Scores

| Screen | Profile | Perf | A11y | Best practices | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| way in `/` | mobile | 85 | 95 | 100 | 0.9 s | 4.4 s | 18 ms | 0 |
| client login | mobile | 85 | 95 | 96 | 0.9 s | 4.4 s | 0 | 0 |
| client code step | mobile | 86 | 95 | 96 | 0.9 s | 4.2 s | 7 ms | 0 |
| client home (building) | mobile | 83 | 96 | 100 | 0.9 s | 4.7 s | 8 ms | 0 |
| client agreement | mobile | 87 | 88 | 100 | 0.9 s | 4.1 s | 7 ms | 0 |
| client questionnaire | mobile | 86 | 96 | 100 | 0.9 s | 4.2 s | 11 ms | 0 |
| client invoices | mobile | 86 | 95 | 96 | 0.9 s | 4.2 s | 11 ms | 0 |
| admin login | desktop | 100 | 95 | 100 | 0.25 s | 0.8 s | 0 | 0 |
| admin dashboard | desktop | 100 | 95 | 100 | 0.25 s | 0.8 s | 0 | 0 |
| admin project | desktop | 99 | 95 | 100 | 0.25 s | 0.9 s | 0 | 0 |
| admin client | desktop | 100 | 95 | 100 | 0.25 s | 0.8 s | 0 | 0 |
| admin agreement editor | desktop | 100 | 95 | 100 | 0.25 s | 0.8 s | 0 | 0 |

## What the numbers say

- **Client LCP is 4.1 to 4.7 s on the mobile profile against a 0.9 s FCP.** The LCP element is always a paragraph of text; its breakdown is TTFB 0.45 s, load delay 0, load time 0, render delay 3.6 to 4.2 s. Six font files are preloaded on every page: Bricolage Grotesque 75 KB, Newsreader 129 KB plus its italic at 144 KB, IBM Plex Mono three at 10 KB, 348 KB in all. Nothing in `src` uses italic. The italic file goes, the optical-size axes go, and the after run checks how much of the render delay that was. No script is render blocking; total blocking time is under 20 ms everywhere.
- **Every accessibility failure but one is the same token.** `color-contrast` fails on `--faint` (#7a7166): 3.92:1 on `--surface`, 3.71:1 on `--ground`, on kickers, help lines, labels, the journey's later steps and mono links. One replacement colour fixes all of it (`04-design-decisions.md` §2).
- **The agreement page's 88** adds `definition-list` and `dlitem`: `<dl class="pairs">` holds nodes that are not `dt`/`dd` pairs. Fixed in the agreement document.
- **Best practices 96** on login, code and invoices: a console error on those pages, checked in Phase 3.
- **CLS is 0 everywhere** and must stay 0 after the sticky bar and toasts are added (they reserve their own space).
- **Admin pages are fast** and stay that way; the admin work in this overhaul is layout and feedback, not performance.

## Targets for the after run

Accessibility 95 or better on every screen (the brief's floor), contrast clean, zero CLS, client LCP under 2.5 s on the same profile, no console errors.
