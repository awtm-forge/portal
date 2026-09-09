import type { UpdateClientView } from "@/modules/serializers";

/** PORTAL-SPEC 6.1: the latest update, in full, on the client's own page. */
export function WeeklyUpdate({ update, full }: { update: UpdateClientView; full: boolean }) {
  if (!full) {
    return (
      <div className="between" style={{ padding: "11px 0", borderBottom: "1px solid var(--rule-soft)" }}>
        <span className="mono-sm" style={{ color: "var(--muted)" }}>Week {update.weekNumber}</span>
        <span className="help">{update.sentAt}</span>
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 12 }}>
      {([
        ["Moved", update.moved],
        ["Next", update.nextUp],
        ["Need from you", needLine(update.needFromYou, update.needByDate)],
        ["Risks", update.risks],
      ] as const)
        .filter(([, value]) => value.trim().length > 0)
        .map(([label, value]) => (
          <div className="stack" style={{ gap: 4 }} key={label}>
            <span className="k">{label}</span>
            <p className="c-sub" style={{ color: "var(--ink)", whiteSpace: "pre-wrap" }}>{value}</p>
          </div>
        ))}
      {update.stagingUrl && (
        <a className="btn-full ghost" href={update.stagingUrl} target="_blank" rel="noopener">Open the work so far</a>
      )}
    </div>
  );
}

/**
 * The date reads as part of the sentence, so a full stop in the middle of it
 * looks like a mistake: "the returns policy copy., by 12 September". Trim the
 * one the person typed rather than asking them not to type it.
 */
function needLine(need: string, by: string | null): string {
  const text = need.trim();
  if (!text) return "";
  if (!by) return text;
  return `${text.replace(/[.,;]+$/, "")}, by ${by}`;
}
