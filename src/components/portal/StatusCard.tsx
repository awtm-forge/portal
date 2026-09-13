import Link from "next/link";
import { CHIP_LABEL, type Chip } from "@/content/client-home";

/**
 * The one thing the client came for: is anything needed from me, and what
 * happens next. The hero of the home page, and the largest type on it.
 *
 * Before 13 Sep the biggest words were the project name, which the client
 * already knows, and this sat under it in a low-contrast box in smaller type.
 *
 * The accent edge appears only when something is needed, so the state reads
 * from across the room. The chip says the state in words as well, because a
 * colour is not a sentence. There is a button only when there is something to
 * do; when there is not, the footer says when to expect us and how we will
 * reach them, which is the answer to "should I check back tomorrow".
 */
export function StatusCard({
  chip,
  headline,
  body,
  expected,
  channel,
  action,
}: {
  chip: Chip;
  headline: string;
  body: string;
  /** A sentence with a real date in it, or nothing. Never invented here. */
  expected?: string | null;
  /** How we will reach them, when there is no date to give. */
  channel?: string | null;
  action?: { label: string; href: string } | null;
}) {
  return (
    <section className={`status${chip === "action" ? " status-act" : ""}`} id="status" tabIndex={-1} aria-labelledby="status-h">
      <p className={`chip chip-${chip}`}>{CHIP_LABEL[chip]}</p>
      <h2 className="status-h" id="status-h">{headline}</h2>
      <p className="status-b">{body}</p>
      {(expected || channel || action) && (
        <div className="status-f">
          <div className="status-when">
            {expected && <p>{expected}</p>}
            {channel && <p>{channel}</p>}
          </div>
          {action && <Link className="btn-primary" href={action.href}>{action.label}</Link>}
        </div>
      )}
    </section>
  );
}
