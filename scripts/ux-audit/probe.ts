/**
 * The probe both the audit script and the end-to-end suite run in the page.
 *
 * One string rather than a function, because tsx renames functions when it
 * transpiles and the renamed helper does not exist inside the browser.
 *
 * It answers one question: can a person see any text sitting on top of other
 * text, or spilling out of the box that holds it? Everything it skips, it
 * skips because that case was a false alarm on a real screen, and each skip
 * says which one.
 */
export type Finding = { kind: "sideways" | "spill" | "cover"; what: string; by: number };

export const PROBE = `(() => {
  const findings = [];
  const doc = document.documentElement;
  const sideways = doc.scrollWidth - doc.clientWidth;
  if (sideways > 1) findings.push({ kind: "sideways", what: "the page", by: Math.round(sideways) });

  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("nextjs-portal, [data-nextjs-toast]")) continue;
    if (!el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) continue;
    if (el.closest("details:not([open])") || el.closest("[hidden], [aria-hidden='true']")) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;

    // A leaf of text: it has words of its own, not only in its children.
    let own = "";
    for (const node of el.childNodes) if (node.nodeType === 3) own += node.textContent;
    own = own.trim();
    if (!own) continue;
    const said = own.replace(/\\s+/g, " ").slice(0, 44);
    const style = getComputedStyle(el);

    const scrollable = /auto|scroll/.test(style.overflowX) || /auto|scroll/.test(style.overflow);
    const clipped = style.textOverflow === "ellipsis" || style.overflow === "hidden";
    const spill = el.scrollWidth - el.clientWidth;
    if (spill > 1 && !scrollable && !clipped) {
      findings.push({ kind: "spill", what: said, by: Math.round(spill) });
    }

    // Cover: ask the browser what is actually painted over this text.
    if (rect.bottom < 0 || rect.top > innerHeight) continue;
    const y = rect.top + rect.height / 2;
    for (const x of [rect.left + 3, (rect.left + rect.right) / 2, rect.right - 3]) {
      if (x < 1 || x > innerWidth - 1 || y < 1 || y > innerHeight - 1) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit) continue;
      if (hit === el || el.contains(hit) || hit.contains(el)) continue;
      // The dev server's own badge is not part of the product.
      if (hit.closest("nextjs-portal, [data-nextjs-toast]")) continue;
      // Chrome that floats above the page on purpose: the sticky action bar
      // at the foot of a long questionnaire, a stuck header, a toast. Being
      // over the content is what they are for, and the page scrolls under
      // them.
      let floater = hit;
      let floats = false;
      while (floater && floater !== document.body) {
        const fs = getComputedStyle(floater).position;
        if (fs === "fixed" || fs === "sticky") { floats = true; break; }
        floater = floater.parentElement;
      }
      if (floats) continue;
      // Text scrolled out of a scroller is clipped, not covered: the admin's
      // nav on a phone keeps four of its five items off to the side, and their
      // boxes sit under whatever comes after the scroller.
      let clipper = el.parentElement;
      let clippedAway = false;
      while (clipper && clipper !== document.body) {
        const cs = getComputedStyle(clipper);
        if (/auto|scroll|hidden/.test(cs.overflowX) || /auto|scroll|hidden/.test(cs.overflow)) {
          const cr = clipper.getBoundingClientRect();
          if (rect.right > cr.right + 1 || rect.left < cr.left - 1) { clippedAway = true; break; }
        }
        clipper = clipper.parentElement;
      }
      if (clippedAway) continue;
      // A cover that wraps the text completely is an overlay doing its job:
      // a table row where the whole row is one link sits over every cell in
      // it, and the words underneath are still perfectly readable. A real
      // overlap is two boxes that only partly meet, which is what the rail
      // labels did.
      const hr = hit.getBoundingClientRect();
      // The hit landed outside the element's own box, so it came from an
      // absolutely positioned pseudo-element: the stretched click target that
      // makes a whole table row one link (a.cover::after). Those are invisible
      // by construction and hide nothing.
      if (x < hr.left - 1 || x > hr.right + 1 || y < hr.top - 1 || y > hr.bottom + 1) continue;
      if (hr.left <= rect.left + 1 && hr.right >= rect.right - 1 && hr.top <= rect.top + 1 && hr.bottom >= rect.bottom - 1) continue;
      let over = "";
      for (const node of hit.childNodes) if (node.nodeType === 3) over += node.textContent;
      findings.push({
        kind: "cover",
        what: said + "  is under  " + (over.trim() || hit.tagName.toLowerCase() + "." + String(hit.className).slice(0, 24)),
        by: Math.round(rect.height),
      });
      break;
    }
  }
  return findings;
})()`;
