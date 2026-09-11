import type { ReactNode } from "react";

/**
 * A closed section with a chevron: a title, an optional fact on the same line
 * ("agreed 11 September"), and the content beneath. Native details, so it
 * works without script and stays open across a re-render when it should.
 * `card` gives it the admin card frame; `ember` lights that frame for the
 * card that carries the phase's action. Without `card` it is a row with a rule.
 */
export function Fold({ title, fact, open, card, ember, id, children }: { title: ReactNode; fact?: ReactNode; open?: boolean; card?: boolean; ember?: boolean; id?: string; children: ReactNode }) {
  return (
    <details className={card ? `a-fold${ember ? " ember" : ""}` : "fold"} open={open} id={id}>
      <summary>
        <span className="fold-t">{title}</span>
        {fact && <span className="fold-fact">{fact}</span>}
        <svg className="fold-chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="fold-b">{children}</div>
    </details>
  );
}
