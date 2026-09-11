"use client";

/** The paper routes' own print control: a phone keeps the browser's in a share sheet (F-18). Hidden on paper. */
export function PrintButton() {
  return (
    <div className="print-bar no-print">
      <button type="button" className="btn-full ghost" style={{ maxWidth: 320 }} onClick={() => window.print()}>Print, or save as PDF</button>
    </div>
  );
}
