import Link from "next/link";
import type { ReactNode } from "react";

export type Column = { key: string; label: string; num?: boolean };
export type Row = { key: string; href?: string; cells: Record<string, ReactNode> };

/**
 * A table on a laptop, a stack of cards on a phone. The first column is the
 * row's title and, when the row has an href, the whole row opens it. Each cell
 * carries its column label for the phone layout, where the head is hidden.
 */
export function DataList({ columns, rows, caption }: { columns: Column[]; rows: Row[]; caption?: string }) {
  return (
    <table className="dl-table">
      {caption && <caption className="visually-hidden">{caption}</caption>}
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col" className={c.num ? "num" : undefined}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className={r.href ? "dl-row dl-link" : "dl-row"}>
            {columns.map((c, i) => (
              <td key={c.key} className={`${i === 0 ? "t" : ""}${c.num ? " num" : ""}`.trim() || undefined} data-label={c.label}>
                {i === 0 && r.href ? <Link className="cover" href={r.href}>{r.cells[c.key]}</Link> : r.cells[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
