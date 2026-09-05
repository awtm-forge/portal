# awtm forge client portal, working folder

Assembled 5 Sep 2026. This folder is the handover to the build. It is not the codebase; the portal is built inside the awtmforge.com Next.js repo.

## What is authoritative

Two files. Everything else here is reference and loses to them wherever they disagree.

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
