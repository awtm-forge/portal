"use client";

import { useState } from "react";
import { STAGES, STAGE_NOTES, type Stage } from "@/content/client-home";

/**
 * Where the client is, in five stages, rebuilt 13 Sep.
 *
 * The three states are told apart by shape before colour: a done stage is a
 * filled disc with a tick in it, the current one is a ring with a filled
 * centre and a heavier label, an upcoming one is a hollow ring. Someone who
 * cannot separate grey from orange still reads the rail.
 *
 * Every stage is a button. Opening one says what happens in that stage and
 * roughly how long it takes, in the words from the content file, so the rail
 * and "How this works" can never drift apart. Opening the stage you are on
 * takes you to the status card instead, because that is where the answer is.
 *
 * On a phone the rail is vertical and the sentence opens directly under the
 * stage you tapped. Horizontally, five stages and their labels do not fit a
 * 390 px line without either shrinking the type or scrolling sideways, and
 * both of those were the old rail's problem.
 */
export function ProgressRail({ now, done }: { now: Stage | null; done: Stage[] }) {
  const [open, setOpen] = useState<Stage | null>(null);
  const nowIndex = STAGES.findIndex((s) => s.key === now);
  const openIndex = STAGES.findIndex((s) => s.key === open);

  function kindOf(key: Stage): "done" | "now" | "later" {
    if (done.includes(key)) return "done";
    return key === now ? "now" : "later";
  }

  function tap(key: Stage) {
    if (key === now) {
      const card = document.getElementById("status");
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.focus({ preventScroll: true });
        return;
      }
    }
    setOpen((was) => (was === key ? null : key));
  }

  return (
    <nav className="rail" aria-label="Project progress">
      <p className="rail-step">
        {nowIndex >= 0 ? `Step ${nowIndex + 1} of ${STAGES.length}` : `All ${STAGES.length} steps done`}
      </p>
      <div className="rail-list">
        {STAGES.map((s, i) => {
          const kind = kindOf(s.key);
          // The line is filled up to where they are: into this stage once it
          // is reached, out of it only once it is behind them.
          const reached = nowIndex < 0 ? STAGES.length : nowIndex;
          return (
            <div
              key={s.key}
              className={`rail-i ${kind}${i <= reached ? " lit" : ""}${i < reached ? " lit-down" : ""}`}
              style={{ order: i * 2 }}
            >
              <button
                type="button"
                className="rail-b"
                aria-current={kind === "now" ? "step" : undefined}
                aria-expanded={open === s.key}
                aria-controls="rail-note"
                onClick={() => tap(s.key)}
              >
                <span className="rail-dot" aria-hidden="true">
                  {kind === "done" && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  )}
                </span>
                <span className="rail-lbl">{s.label}</span>
                <span className="visually-hidden">
                  {kind === "done" ? ", done" : kind === "now" ? ", where you are now" : ", still to come"}
                </span>
              </button>
            </div>
          );
        })}

        <div
          className="rail-note"
          id="rail-note"
          hidden={open === null}
          style={{ order: openIndex >= 0 ? openIndex * 2 + 1 : 11 }}
        >
          {open && (
            <>
              <p>{STAGE_NOTES[open].what}</p>
              <p className="rail-howlong">{STAGE_NOTES[open].how_long}</p>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
