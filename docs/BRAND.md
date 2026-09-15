# Brand, as the portal applies it

Written 15 September 2026 from the brand's own invoice, the PDF Ayush shared
that day ("that follows brand guidelines. you have to follow it throughout the
portal"). The values below were read from the PDF's embedded fonts and sampled
from its render, and they are what the token file, the print routes and every
screen in both portals now follow. The guidelines document itself is not in
this repo; this page is the portal's reading of it, and the tests hold it.

## Two faces of one system

The brand has a paper face and a dark face, and they share their ink, their
orange and their type. The document is the paper face. The portals open in the
dark face by Ayush's decision of 13 September, kept on 15 September, with the
paper face one tap away on the bar in both. The print routes are always paper,
on screen and on the page.

| Role | Paper (`html[data-theme="light"]`, `.paper`) | Dark (`:root`) |
|---|---|---|
| ground | `#f3eee6` | `#141110` |
| surface | `#f9f5ee` | `#1b1715` |
| surface-raised | `#fbf8f3` | `#221d1a` |
| surface-float | `#fffdf9` | `#221d1a` |
| ink | `#141110` | `#ede7dc` |
| ink-muted | `#4e4741` | `#b0a496` |
| accent, as text | `#a8561a` | `#e08536` |
| accent-fill | `#c96d1b` | `#e08536` |
| accent-ink, on a fill | `#141110` | `#181008` |
| hairline | `#dcd3c5` | `#2e2925` |
| off, dimmed controls | `#b5ada2` | `#605850` |

The ink of the paper face is the ground of the dark face, to the digit. The
wordmark's orange is `#e08638` on both, as a logotype, which WCAG exempts from
the contrast rule; as text on paper the accent is the document's emphasis
terracotta, `#a8561a`, because the wordmark orange is 2.4:1 on cream and would
fail as a word. Every pairing in `scripts/contrast.ts` is measured in both
faces by `tests/contrast.test.ts`, 4.5:1 for text and 3:1 for anything
non-text that carries meaning, and a change to any value above that breaks a
pairing fails the suite.

## Type

Three faces, each with one job.

- **Bricolage Grotesque**, ExtraBold for display: the wordmark, document
  titles, headings, the big total. On screens the same family at 600 carries
  headings and, in the client portal, every sentence too (13 September: two
  voices there, not four).
- **Inter**, Regular to Semibold, for sentences on paper: the print routes
  only, loaded without preload so it never sits ahead of a client page.
- **IBM Plex Mono**, Regular and Medium, for labels and figures: uppercase,
  tracked 0.12 to 0.16 em, 11 to 12 px, in the accent or the muted ink. Dates,
  numbers and week counts are mono too.

## The document conventions

What the invoice does, the agreement now does, and any new document should:

- The wordmark top left with the last word in orange; the document's name top
  right in display ExtraBold, with its facts under it as a mono-label list.
- The key number underlined with a dashed line in the accent.
- One heavy 3 px rule in ink under the head; hairlines everywhere else.
- Labels are mono capitals in the accent ("Billed to", "Payment details").
- Sums at the right, the total in the emphasis terracotta at display size,
  the amount in words beneath it.
- Rounded cards at 14 px on the raised surface for payment details and notes.
- "Thank you." with an orange full stop, then the company name and contact.
- Nothing invented to fill a slot: a due date, a timeline, a per-deal line
  appear only when the system holds them.

## What "throughout the portal" means in practice

A screen follows the brand when it uses the roles above by name and nothing
else: no colour that is not a token, no face that is not one of the three, no
label that is not mono capitals. The paper face is not a second design; it is
the same roles with paper values, and a screen that reads well in one face
reads well in the other because the pairings are the same. The overlap sweep
and the contrast test run in both faces, so a screen that breaks either fails
before it ships.
