# ADR 0008: the questionnaire is a versioned JSON document, imported and rendered, never edited in the portal

## Status
Accepted, 5 Sep 2026

## Context
Each client's questionnaire is generated in conversation from a problem statement and revised there. An editor in the portal would create a second source of truth. A form builder is a product in itself.

## Decision
One JSON contract, `version: 1`, eight field types and no conditional logic. Admin uploads the document; the importer validates it (including refusing upload fields in the access section) and the portal renders it. A change is a new document. Validators and renderers live in `modules/intake/versions/v1.ts`; a future version is a sibling file chosen by `document.version`.

## Consequences
No editor to build or secure. Old intakes keep rendering as they were. The importer is the gate that enforces the credential rule. The cost is a round trip through the conversation for any wording change, which is the point.
