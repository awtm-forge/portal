import Link from "next/link";
import type { Attention } from "@/modules/projects/attention";

/**
 * PORTAL-SPEC 6.6. Computed on read, so it is never stale and there is
 * nothing to reconcile. Worst first, because the top of this list is the
 * order to work in.
 */
export function NeedsAttention({ items }: { items: Attention[] }) {
  if (items.length === 0) {
    return (
      <div className="a-card">
        <span className="k">Needs attention</span>
        <p className="c-sub" style={{ fontSize: 14 }}>Nothing is waiting on us. Everything is inside its window.</p>
      </div>
    );
  }

  return (
    <div className="a-card">
      <div className="between">
        <span className="k">Needs attention</span>
        <span className="tag" style={{ color: "var(--ember)" }}>{items.length}</span>
      </div>
      <div className="stack">
        {items.map((item) => (
          <div
            key={`${item.projectId}-${item.reason}-${item.days}`}
            className="between"
            style={{ padding: "11px 0", borderBottom: "1px solid var(--rule-soft)", gap: 16 }}
          >
            <span className="stack" style={{ gap: 3 }}>
              <Link href={item.projectId ? `/admin/projects/${item.projectId}` : `/admin/clients/${item.clientId}`} className="sec-name" style={{ fontSize: 14, textDecoration: "none" }}>
                {item.projectName}
              </Link>
              <span className="help">{item.businessName}</span>
            </span>
            <span className="mono-sm" style={{ color: "var(--ember)", textAlign: "right" }}>{item.line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
