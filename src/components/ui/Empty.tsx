import type { ReactNode } from "react";

/** Nothing here yet, said the same way everywhere: what would be here, and what makes it appear. */
export function Empty({ title, line, action }: { title: string; line?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-t">{title}</p>
      {line && <p className="empty-l">{line}</p>}
      {action}
    </div>
  );
}
