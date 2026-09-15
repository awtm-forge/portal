# 25. A client's files are a place, shared both ways

Accepted, 16 September 2026. Attaches to the "new journey step" seam in
ARCHITECTURE.md without adding a phase.

## The problem

Ayush: "There should be upload document section for the client so that they
can upload document on the client portal and then we can access them."

The questionnaire takes uploads, but only in answer to a question and only
while it is open. A client with a logo, a folder of photos or a PDF of their
current brand guide had no place to put it, and the team had no place to hand
a client a file back, so both went over WhatsApp and were lost in the thread.

## The decision

One page in the client portal, Your files, listed in the menu from the moment
they sign in. One list, newest first, and one form: images and PDFs, ten
megabytes each, ten at a time, with a line about them if it helps. The same
list on the team's side, a card on the client's page, with the same form.

Both directions tell the other side once. A client's upload writes
`document.uploaded`, which the team's bell and email carry with the names and
the line; a team upload writes `document.added`, which the client's bell and
email carry with a pointer to Your files. Two event types rather than one
with a flag, so the team's unread count never counts the team's own uploads.

A file is stored through the questionnaire's own pipeline (INTAKE-SPEC
section 4): type by magic bytes and never by extension, images re-encoded
with EXIF stripped, SVG sanitised, PDF as is, in the client's own directory
under `UPLOAD_DIR`, served only through a route that has checked who is
asking, on either side. What the pipeline refuses is refused by name, so a
Word document or a spreadsheet is told rather than swallowed; adding those is
a pipeline change, not a page change, and a seam for later.

A file is not evidence. Either side can remove one, row and bytes together.
Removing a client takes their files with them, and the clean start does too.

## What it costs

One table, `ClientDocument`, and a migration. A new menu entry, which the
menu was made for. Uploads go through route handlers rather than server
actions, because server actions cap their body far below ten megabytes; the
forms are plain HTML and post directly, which also means they work without
JavaScript.
