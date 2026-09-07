# Handover: what this repo was given to start from

Assembled 5 Sep 2026, moved here from the root README on 7 Sep 2026 once the folder became the repo. This is the map of the material the build started from; the repo README at the root is about running the code.

## Start here

`KICKOFF.md` says how to start or resume the Claude Code session and what to paste. `CLAUDE.md` is the standing brief that session reads every time it starts; it carries the working method, the non-negotiables, the decisions taken after the specs were written, the architecture, the documentation set, the deployment boundary, and the replacement copy for the site's "How we work" section.

## The design

`docs/` is the architecture the build follows and keeps true: `ARCHITECTURE.md` (zones, boundaries, the seams where later features attach), `DFD.md` (level 0 and level 1 data flow diagrams), `DATA-MODEL.md` (entity relationship diagram and the phase state machine), `SEQUENCES.md` (the four interactions where order matters), and `adr/` (the accepted decisions, one file each, with a template for the next). All diagrams are Mermaid and render on GitHub.

## What is authoritative

Two files. Everything else here is reference and loses to them wherever they disagree, except `CLAUDE.md` §5, which records decisions taken after they were written.

- `PORTAL-SPEC.md` (version 2). The portal: one agreement, one review loop, two invoices, day 30. Build order in §9, acceptance criteria in §10, questions to ask rather than guess in §11.
- `INTAKE-SPEC.md` (version 2). The questionnaire: a generated JSON document uploaded per client, eight field types, no editing inside the portal.

## What is reference only

`reference/awtm-portal-screens.html` is the design canvas with all eighteen screens; `reference/mocks/*.dc.html` are the same screens as individual pages, one per file. Use them for layout, spacing, tone and the one-thing-to-do rule. Three of them predate version 2 and show a per-stage "Agree" button that no longer exists: `ClientReady`, `ClientAgreed`, `AdminStage`. Where a mock and the spec disagree, the spec wins.

`reference/awtm-funnel.html` and `reference/awtm-pipeline.html` are the planning pages the spec grew out of. Both still describe four stage gates and a 30/30/30/10 payment split. Superseded by PORTAL-SPEC §1 and §5. Read them for context, not for behaviour.

`reference/awtm-dummy-site.html` is the marketing site draft. Its design tokens and component language are what the portal must match (PORTAL-SPEC §8 and acceptance criterion 20). Its "How we work" section is stale for the same reason and is rewritten separately before launch.

## Image library

`image-library/logo-directions/` holds six logo direction images (SVG plus PNG, and a contact sheet) for `image_choice` questions in the intake. They are uploaded into the portal's `image_library` table once INTAKE-SPEC §9 is built, keyed `logo-wordmark`, `logo-monogram`, `logo-emblem`, `logo-mascot`, `logo-abstract`, `logo-combination`. They are sample directions on a placeholder brand, not client work.

## Not in this folder

- Questionnaire JSON files for real clients. Each one is finalised in conversation and dropped in as `intake-<client>-<date>.json` when ready. None exists yet.
- Any credential, key or account detail. The specs forbid storing client secrets anywhere in the system, and nothing in this folder should ever need one either.
