# ADR 0007: printable routes instead of server-side PDF generation

## Status
Accepted, 5 Sep 2026

## Context
Invoices and agreements must be saveable as PDF. Puppeteer or headless Chrome on a shared Node host is heavy, fragile and a security surface; a PDF library means maintaining a second layout of every document.

## Decision
`/invoice/[id]/print` and `/agreement/[id]/print` are the same React views with a print stylesheet: A4, no navigation, no buttons, correct margins, no internal cost. The browser prints to PDF. If a server-side file is ever required, pdfkit, never a browser.

## Consequences
One layout per document. Zero extra runtime memory. The client's PDF is whatever their browser prints, so the print stylesheet is tested in Chromium and Safari before launch. A signed agreement's PDF is a rendering of the frozen record, not a stored file; the record is the evidence.
