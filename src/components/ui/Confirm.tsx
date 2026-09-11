"use client";

import { useId, useRef, type ReactNode } from "react";

/**
 * A native dialog around the real form. The safe choice is focused first and
 * Escape or the backdrop closes it; the action only runs from the ember
 * button. Used for the few things that cannot be undone: rotating a link,
 * cancelling a project, deleting a referral or an image.
 */
export function Confirm({
  trigger,
  triggerClass = "a-btn ghost",
  title,
  line,
  confirmLabel,
  keepLabel = "Keep it",
  action,
  children,
}: {
  trigger: ReactNode;
  triggerClass?: string;
  title: string;
  line?: string;
  confirmLabel: string;
  keepLabel?: string;
  action: (formData: FormData) => void | Promise<void>;
  /** Hidden inputs and any field the action needs, a reason for instance. */
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button type="button" className={triggerClass} onClick={() => ref.current?.showModal()}>{trigger}</button>
      <dialog
        ref={ref}
        className="dlg"
        aria-labelledby={titleId}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      >
        <form action={action} className="dlg-in">
          <h2 id={titleId}>{title}</h2>
          {line && <p>{line}</p>}
          {children}
          <div className="dlg-actions">
            <button type="button" className="a-btn ghost" onClick={() => ref.current?.close()} autoFocus>{keepLabel}</button>
            <button type="submit" className="a-btn">{confirmLabel}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
