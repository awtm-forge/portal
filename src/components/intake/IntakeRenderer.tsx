"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { StickyAction } from "@/components/ui/StickyAction";
import type { IntakeDocument, Question, Section } from "@/modules/intake/document";
import type { Answers } from "@/modules/intake/answers";
import type { IntakeStateClientView } from "@/modules/serializers";

/**
 * INTAKE-SPEC section 11. One column, one open section, one button. The
 * same component serves the client (mode "client") and the team typing from
 * a call (mode "team"); only the API base and a few labels differ.
 */
export type RendererProps = {
  doc: IntakeDocument;
  initialAnswers: Answers;
  initialAccess: Record<string, boolean>;
  initialDone: string[];
  initialFiles: Record<string, FileInfo>;
  submittedAt: string | null;
  apiBase: string;
  fileBase: string;
  libBase: string;
  mode: "client" | "team";
  prefill: { name: string; email: string };
  kickoffDateText: string;
  contactFirstName: string;
  /** ADR 0016: once sent, what the questionnaire is doing now. */
  state: IntakeStateClientView;
  /** When the latest version was sent; the first sending when there is only one. */
  lastSentAt: string | null;
  /** The client home, for the completion screen. Client mode only. */
  homeHref?: string;
};

export type FileInfo = { id: string; name: string; mime: string; hasThumb: boolean };

type SaveStatus = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: number } | { kind: "error"; message: string };

const ACCESS_TEXT_1 = "Add us as a user. Never send a password.";
const ACCESS_TEXT_2 = "Every line below is something you grant from inside your own account, and can remove the day we finish. If you are not sure how on any of them, leave it and we will do it together on the kickoff call.";
const ACCESS_TEXT_3 = "Never type a password, an API key or an OTP into this page, into WhatsApp, or into an email to us. There is no box here that wants one.";

export function IntakeRenderer(p: RendererProps) {
  const [answers, setAnswers] = useState<Answers>(p.initialAnswers);
  const [access, setAccess] = useState<Record<string, boolean>>(p.initialAccess);
  const [done, setDone] = useState<Set<string>>(new Set(p.initialDone));
  const [files, setFiles] = useState<Record<string, FileInfo>>(p.initialFiles);
  const [submitted, setSubmitted] = useState<string | null>(p.submittedAt);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [message, setMessage] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [state, setState] = useState<IntakeStateClientView>(p.state);
  const [justSent, setJustSent] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(p.lastSentAt);
  const sections = p.doc.sections;
  const firstOpen = useMemo(() => {
    const idx = sections.findIndex((s) => !p.initialDone.includes(s.key));
    return idx === -1 ? sections.length - 1 : idx;
  }, [sections, p.initialDone]);
  const [open, setOpen] = useState<number>(firstOpen);
  const [signedOut, setSignedOut] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  const post = useCallback(async (action: string, body: unknown): Promise<{ ok: boolean; message?: string; at?: string }> => {
    setStatus({ kind: "saving" });
    try {
      const res = await fetch(`${p.apiBase}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; at?: string };
      // The session ran out under them (F-06): say so, and that nothing typed
      // so far is lost, rather than blaming the connection.
      if (res.status === 401) {
        setSignedOut(true);
        setStatus({ kind: "error", message: "You were signed out. Everything saved so far is kept." });
        return { ok: false, message: "You were signed out." };
      }
      if (!res.ok || !data.ok) {
        setStatus({ kind: "error", message: data.message ?? "Could not save. Check the connection." });
        return { ok: false, message: data.message };
      }
      setStatus({ kind: "saved", at: Date.now() });
      return { ok: true, at: data.at };
    } catch {
      setStatus({ kind: "error", message: "Could not save. Check the connection." });
      return { ok: false };
    }
  }, [p.apiBase]);

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const enteredBy = p.mode;

  const setLocal = useCallback((key: string, patch: Partial<Answers[string]>) => {
    setAnswers((prev) => {
      const next = { ...prev };
      const cur = next[key] ?? { entered_by: enteredBy, at: new Date().toISOString() };
      next[key] = { ...cur, ...patch, entered_by: enteredBy, at: new Date().toISOString() };
      return next;
    });
  }, [enteredBy]);

  const saveNow = useCallback((key: string, value: unknown) => post("save", { key, value }), [post]);

  const saveDebounced = useCallback((key: string, value: unknown) => {
    clearTimeout(timers.current[key]);
    setStatus({ kind: "saving" });
    timers.current[key] = setTimeout(() => { void saveNow(key, value); }, 600);
  }, [saveNow]);

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  async function saveAndCarryOn() {
    setMessage(null);
    const section = sections[open];
    const r = await post("section-done", { section: section.key });
    if (!r.ok) return;
    setDone((prev) => new Set(prev).add(section.key));
    if (open < sections.length - 1) {
      setOpen(open + 1);
      requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  /**
   * Move a section either way without marking anything. Nothing is saved or
   * unsaved by it: answers save as they are typed, and a section already
   * marked done stays done. Section titles are tappable too, but nobody found
   * that on 10 September, so the way through is written down under the button.
   *
   * Next is not the same as "Save and carry on": that one marks the section
   * finished. A client who cannot answer this section yet needs a way past it
   * that does not tell the progress bar they are done (Ayush, 12 Sep).
   */
  function goTo(index: number) {
    if (index < 0 || index > sections.length - 1 || index === open) return;
    setMessage(null);
    setOpen(index);
    requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function finishAndSend() {
    setMessage(null);
    const missing = requiredMissing(p.doc, answers);
    if (missing.length) {
      const idx = sections.findIndex((s) => s.questions.some((q) => missing.includes(q.key)));
      if (idx >= 0) setOpen(idx);
      setMessage("Who says yes, and their email, are the two answers we need before sending.");
      return;
    }
    const r = await post("submit", {});
    if (!r.ok) { setMessage(r.message ?? "Could not send. Try again."); return; }
    setSubmitted(r.at ?? new Date().toISOString());
    setLastSentAt(r.at ?? null);
    setState({ kind: "locked", declinedReply: null });
    setDone(new Set(sections.map((s) => s.key)));
    setJustSent(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** ADR 0016: sending the changes closes the open request as the next version and locks it again. */
  async function sendChanges() {
    setMessage(null);
    const r = await post("submit", {});
    if (!r.ok) { setMessage(r.message ?? "Could not send. Try again."); return; }
    setEditingKey(null);
    setLastSentAt(r.at ?? new Date().toISOString());
    setState({ kind: "locked", declinedReply: null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** One line on what needs changing. The team opens it or says why not. */
  async function askToOpen(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const note = String(new FormData(e.currentTarget).get("note") ?? "");
    const r = await post("ask-change", { note });
    if (!r.ok) { setMessage(r.message ?? "Could not send. Try again."); return; }
    setState({ kind: "asked", askedAt: new Date().toISOString() });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const doneCount = sections.filter((s) => done.has(s.key)).length;
  const lastSavedText = statusText(status);
  const signedOutNote = signedOut && p.mode === "client" ? (
    <p className="msg" style={{ marginTop: 8 }}>
      You were signed out. Your answers are saved.{" "}
      <a href={p.homeHref ?? "."} style={{ color: "inherit" }}>Open your page again</a> to carry on; it asks for a code first.
    </p>
  ) : null;

  // The completion screen (item 6): a clear "you have submitted it" moment,
  // shown once after the first send, before the read-only answers.
  if (justSent && p.mode === "client") {
    return (
      <div style={{ padding: "48px 20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
        <span className="done-mark" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--on-ember)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <div className="stack" style={{ gap: 10, maxWidth: 460 }}>
          <p className="k ember">Questionnaire submitted</p>
          <h1 className="c-title" style={{ fontSize: 26 }}>Thank you. That is everything we need for now.</h1>
          <p className="c-sub">We will read through your answers and turn them into your plan: what we will build, what it costs, when it lands, and how you will check it. It turns up on your page when it is ready, and we will message you. We will reach out if we need anything more.</p>
        </div>
        <div className="stack" style={{ gap: 10, width: "100%", maxWidth: 360, marginTop: 6 }}>
          {p.homeHref && <a className="btn-full" href={p.homeHref}>See your page</a>}
          <button className="btn-full ghost" type="button" onClick={() => setJustSent(false)}>Review what you sent</button>
        </div>
      </div>
    );
  }

  // After sending (ADR 0016, Q14): read-only and locked, until the team opens
  // it for a change. Then tap an answer to change it, and send. The access
  // ticks stay live throughout: they are granted over the days that follow.
  if (submitted) {
    const editable = state.kind === "changing";
    const sentLine = `Sent on ${formatDay(submitted)}.${lastSentAt && lastSentAt !== submitted ? ` Changes sent ${formatDay(lastSentAt)}.` : ""}`;
    const accessToggle = (k: string, v: boolean) => { setAccess((a) => ({ ...a, [k]: v })); void post("access", { key: k, granted: v }); };
    // The ask lives at the top, beside the status that explains the lock
    // (F-08); a line at the foot points back up for whoever read to the end.
    const askForm = p.mode === "client" && state.kind === "locked" ? (
      <div className="card" style={{ margin: "14px 20px 0", padding: "16px" }} id="ask-change">
        <div className="stack" style={{ gap: 10 }}>
          <p className="sec-name" style={{ fontSize: 15 }}>Need to change an answer?</p>
          <p className="c-sub">Tell us what needs changing, in a line, and we open it for you.</p>
          <form className="stack" style={{ gap: 10 }} onSubmit={askToOpen}>
            <label className="visually-hidden" htmlFor="ask-note">What needs changing, in a line</label>
            <textarea id="ask-note" className="fld" name="note" rows={2} maxLength={2000} placeholder="The platform has changed since we spoke." required />
            {message && <p className="msg">{message}</p>}
            <button className="btn-full ghost" type="submit" disabled={status.kind === "saving"}>Request a change</button>
          </form>
        </div>
      </div>
    ) : null;
    return (
      <div>
        <div style={{ padding: "24px 20px 0" }} className="stack">
          <p className="k">{p.doc.title}</p>
          <h1 className="c-title" style={{ marginTop: 10 }}>{p.mode === "client" ? "Your answers" : "Their answers"}</h1>
          {p.mode === "client" && state.kind === "changing" && (
            <p className="c-sub" style={{ marginTop: 10 }}>Open for changes. Tap an answer to change it, then press Send the changes.</p>
          )}
          {p.mode === "client" && state.kind === "asked" && (
            <p className="c-sub" style={{ marginTop: 10 }}>{sentLine} You asked on {formatDay(state.askedAt)} to change something. We will open it and message you.</p>
          )}
          {p.mode === "client" && state.kind === "locked" && (
            <p className="c-sub" style={{ marginTop: 10 }}>{sentLine} It is locked now, so nothing changes by accident.</p>
          )}
          {p.mode === "client" && state.kind === "locked" && state.declinedReply && (
            <p className="c-sub" style={{ marginTop: 8, color: "var(--ember)" }}>We could not open it this time: {state.declinedReply}</p>
          )}
          {p.mode === "team" && (
            <p className="c-sub" style={{ marginTop: 10 }}>{sentLine}{editable ? " Open for changes. What you type here is marked as taken on a call." : " Locked. Open it for changes from their page to type into it."}</p>
          )}
          {(editable || status.kind !== "idle") && <p className="help" style={{ marginTop: 8 }}>{lastSavedText}</p>}
          {signedOutNote}
        </div>
        {askForm}
        <div className="stack" style={{ gap: 12, marginTop: 18 }}>
          {sections.map((s) => {
            // Read-only: only what they answered, and one line for the rest,
            // instead of a placeholder per question that nothing can act on (F-07).
            const shown = editable ? s.questions : s.questions.filter((q) => !isEmptyAnswer(q, answers));
            const unanswered = s.questions.length - shown.length;
            return (
              <div key={s.key} className="card" style={{ margin: "0 20px" }}>
                <div className="card-h open"><span className="sec-name">{s.title}</span><span className={`tag${editable ? " ember" : ""}`}>{editable ? "Open" : "Done"}</span></div>
                <div className="card-b">
                  {s.access_items && <AccessBlock items={s.access_items} access={access} kickoff={p.kickoffDateText} onToggle={accessToggle} />}
                  {shown.map((q) => (
                    <div key={q.key} className="stack" style={{ gap: 6 }}>
                      <p className="q">{q.text}</p>
                      {editable && editingKey === q.key ? (
                        <>
                          <Field q={q} answers={answers} files={files} p={p} setLocal={setLocal} saveNow={saveNow} saveDebounced={saveDebounced} setFiles={setFiles} setStatus={setStatus} post={post} />
                          <button className="btn-full ghost" type="button" onClick={() => setEditingKey(null)}>Done with this answer</button>
                        </>
                      ) : editable ? (
                        <button type="button" className="fld" style={{ textAlign: "left", cursor: "pointer", minHeight: 44 }} onClick={() => setEditingKey(q.key)}>
                          <ReadOnlyValue q={q} answers={answers} files={files} editable />
                        </button>
                      ) : (
                        <div className="fld" style={{ minHeight: 44 }}><ReadOnlyValue q={q} answers={answers} files={files} /></div>
                      )}
                    </div>
                  ))}
                  {!editable && unanswered > 0 && (
                    <p className="help">{shown.length === 0 && !s.access_items ? "Nothing answered in this section." : `${unanswered} not answered.`}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {p.mode === "client" && editable && (
          <div style={{ padding: "16px 20px 0" }} className="stack">
            {message && <p className="msg">{message}</p>}
            <button id="send-changes" className="btn-full" type="button" onClick={sendChanges} disabled={status.kind === "saving"}>Send the changes</button>
            <p className="help" style={{ textAlign: "center" }}>It locks again after this, and we see what changed.</p>
            <StickyAction targetId="send-changes" label="Send the changes" hint="Done changing?" />
          </div>
        )}
        {p.mode === "client" && state.kind === "locked" && (
          <p className="help" style={{ padding: "16px 20px 0", textAlign: "center" }}>
            Need to change an answer? <a href="#ask-change" style={{ color: "var(--ember)" }}>Ask at the top of this page</a>.
          </p>
        )}
        <RuleBlock />
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: "24px 20px 18px" }} className="stack">
        <p className="k">{p.mode === "team" ? "Typing for the client" : "Your questionnaire"}</p>
        <h1 className="c-title" style={{ marginTop: 10 }}>{p.doc.title}</h1>
        {p.doc.intro && <p className="c-sub" style={{ marginTop: 10 }}>{p.doc.intro}</p>}
        {p.mode === "team" && <p className="help" style={{ marginTop: 8, color: "var(--ember)" }}>Every answer typed here is marked as taken on a call, not entered by the client.</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
          <div className="progress"><div style={{ width: `${Math.round((doneCount / Math.max(1, sections.length)) * 100)}%` }} /></div>
          <span className="mono-sm" style={{ flex: "none" }}>{doneCount} of {sections.length}</span>
        </div>
        <p className="help" style={{ marginTop: 10 }}>{lastSavedText}. Tap any section to jump to it, in any order</p>
        {signedOutNote}
      </div>

      <div className="stack" style={{ gap: 12 }}>
        {sections.map((s, i) => {
          const isOpen = i === open;
          const isDone = done.has(s.key);
          const state: "done" | "now" | "later" = isOpen ? "now" : isDone ? "done" : "later";
          return (
            <div key={s.key} ref={isOpen ? sectionRef : undefined} className={`card${isOpen ? " now" : isDone ? "" : " later"}`} style={{ margin: "0 20px", scrollMarginTop: 16 }}>
              <button type="button" className={`card-h${isOpen ? " open" : ""}`} style={{ width: "100%", background: "none", border: "none", cursor: isOpen ? "default" : "pointer", textAlign: "left", color: "inherit" }} onClick={() => { if (!isOpen) { setOpen(i); setMessage(null); } }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {state === "done" ? <Tick /> : <span className="mono-sm" style={{ color: isOpen ? "var(--ember)" : "var(--faint)" }}>{i + 1}</span>}
                  <span className={`sec-name${state === "later" ? " dim" : ""}`}>{s.title}</span>
                </span>
                <span className={`tag${state === "now" ? " ember" : state === "later" ? " dim" : ""}`}>{state === "done" ? "Done" : state === "now" ? "Now" : "Later"}</span>
              </button>
              {isOpen && (
                <div className="card-b">
                  {s.intro && <p className="c-sub" style={{ fontSize: 14 }}>{s.intro}</p>}
                  {s.access_items && <AccessBlock items={s.access_items} access={access} kickoff={p.kickoffDateText} onToggle={(k, v) => { setAccess((a) => ({ ...a, [k]: v })); void post("access", { key: k, granted: v }); }} />}
                  {s.questions.map((q) => (
                    <div key={q.key} className="stack" style={{ gap: 6 }}>
                      <p className="q">{q.text}</p>
                      {q.help && <p className="help">{q.help}</p>}
                      <Field q={q} answers={answers} files={files} p={p} setLocal={setLocal} saveNow={saveNow} saveDebounced={saveDebounced} setFiles={setFiles} setStatus={setStatus} post={post} />
                      {(q.key === "dec_signoff_name" || q.key === "dec_signoff_email") && p.mode === "client" && (
                        <p className="help">Filled in from what you told {p.contactFirstName ? "us" : "us"}. Change it if someone else signs off. The six digit code moves to a new address once we confirm it.</p>
                      )}
                    </div>
                  ))}
                  {message && <p className="msg">{message}</p>}
                  {i < sections.length - 1 ? (
                    <button id="section-action" className="btn-full" type="button" onClick={saveAndCarryOn} disabled={status.kind === "saving"}>Save and carry on</button>
                  ) : p.mode === "client" ? (
                    <button id="section-action" className="btn-full" type="button" onClick={finishAndSend} disabled={status.kind === "saving"}>Finish and send</button>
                  ) : (
                    <button id="section-action" className="btn-full ghost" type="button" onClick={saveAndCarryOn} disabled={status.kind === "saving"}>Save. The client sends it.</button>
                  )}
                  {p.mode === "client" && (
                    <StickyAction key={s.key} targetId="section-action" label={i < sections.length - 1 ? "Save and carry on" : "Finish and send"} hint={`Section ${i + 1} of ${sections.length}`} />
                  )}
                  {i === sections.length - 1 && p.mode === "client" && <p className="help" style={{ textAlign: "center" }}>After sending it locks. If something needs changing later, you can ask us to open it from this page.</p>}
                  {sections.length > 1 && (
                    <div className="secmove">
                      {i > 0 ? (
                        <button className="backlink" type="button" onClick={() => goTo(i - 1)} disabled={status.kind === "saving"}><span aria-hidden="true">←</span> Back</button>
                      ) : <span />}
                      {i < sections.length - 1 && (
                        <button className="backlink" type="button" onClick={() => goTo(i + 1)} disabled={status.kind === "saving"}>Next <span aria-hidden="true">→</span></button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <RuleBlock />
    </div>
  );
}

function statusText(s: SaveStatus): string {
  switch (s.kind) {
    case "idle": return "Saves as you type";
    case "saving": return "Saving";
    case "saved": return "Saved a moment ago";
    case "error": return s.message;
  }
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

function requiredMissing(doc: IntakeDocument, answers: Answers): string[] {
  return doc.sections.flatMap((s) => s.questions).filter((q) => q.required && !(typeof answers[q.key]?.value === "string" && (answers[q.key].value as string).length > 0)).map((q) => q.key);
}

function Tick() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ember)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;
}

function RuleBlock() {
  return (
    <div className="rule-box" style={{ margin: "22px 20px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ember)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        <span className="k ember">One rule, and we mean it</span>
      </div>
      <p className="c-sub" style={{ fontSize: 13.5 }}>{ACCESS_TEXT_3} The access section asks you to add us as a user on your own systems instead, which you can undo any time.</p>
    </div>
  );
}

function AccessBlock({ items, access, kickoff, onToggle }: { items: NonNullable<Section["access_items"]>; access: Record<string, boolean>; kickoff: string; onToggle: (key: string, v: boolean) => void }) {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <p className="sec-name" style={{ fontSize: 17, lineHeight: 1.2 }}>{ACCESS_TEXT_1}</p>
      <p className="c-sub" style={{ fontSize: 14 }}>{ACCESS_TEXT_2}</p>
      <p className="c-sub" style={{ fontSize: 14 }}>{ACCESS_TEXT_3}</p>
      <div className="opts">
        {items.map((it) => {
          const on = access[it.key] === true;
          return (
            <label key={it.key} className={`opt${on ? " on" : ""}`} style={{ alignItems: "flex-start", position: "relative" }}>
              <input type="checkbox" checked={on} onChange={(e) => onToggle(it.key, e.target.checked)} />
              <span className="check" style={{ marginTop: 2 }}>{on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--on-ember)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}</span>
              <span className="stack" style={{ gap: 3, minWidth: 0 }}>
                <span style={{ color: on ? "var(--muted)" : "var(--ink)" }}>{it.label}</span>
                {it.help && <span className="help">{it.help}</span>}
              </span>
            </label>
          );
        })}
      </div>
      <p className="help" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 12, lineHeight: 1.65 }}>Anything still unticked on {kickoff} pauses the clock, and we will say so in writing rather than quietly slipping.</p>
    </div>
  );
}

type FieldProps = {
  q: Question;
  answers: Answers;
  files: Record<string, FileInfo>;
  p: RendererProps;
  setLocal: (key: string, patch: Partial<Answers[string]>) => void;
  saveNow: (key: string, value: unknown) => Promise<{ ok: boolean; message?: string }>;
  saveDebounced: (key: string, value: unknown) => void;
  setFiles: React.Dispatch<React.SetStateAction<Record<string, FileInfo>>>;
  setStatus: React.Dispatch<React.SetStateAction<SaveStatus>>;
  post: (action: string, body: unknown) => Promise<{ ok: boolean; message?: string }>;
};

function Field({ q, answers, files, p, setLocal, saveNow, saveDebounced, setFiles, setStatus, post }: FieldProps) {
  const a = answers[q.key];
  switch (q.type) {
    case "short_text":
    case "link": {
      const prefill = q.key === "dec_signoff_name" ? p.prefill.name : q.key === "dec_signoff_email" ? p.prefill.email : "";
      const value = typeof a?.value === "string" ? a.value : prefill;
      return (
        <div className="fld" style={{ display: "flex", gap: 6, padding: 0 }}>
          {prefill && a === undefined && <SeedPrefill fieldKey={q.key} prefill={prefill} setLocal={setLocal} saveNow={saveNow} />}
          {q.type === "link" && <span style={{ padding: "11px 0 11px 13px", color: "var(--faint)" }}>https://</span>}
          <input
            type={q.key === "dec_signoff_email" ? "email" : q.type === "link" ? "url" : "text"}
            inputMode={q.type === "link" ? "url" : undefined}
            value={q.type === "link" ? value.replace(/^https?:\/\//i, "") : value}
            onChange={(e) => { const v = e.target.value; setLocal(q.key, { value: v }); saveDebounced(q.key, v); }}
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", color: "inherit", font: "inherit", padding: q.type === "link" ? "11px 13px 11px 0" : "11px 13px", outline: "none" }}
            maxLength={500}
            autoComplete="off"
          />
        </div>
      );
    }
    case "long_text": {
      const value = typeof a?.value === "string" ? a.value : "";
      return <textarea className="fld" value={value} maxLength={8000} onChange={(e) => { const v = e.target.value; setLocal(q.key, { value: v }); saveDebounced(q.key, v); }} />;
    }
    case "yes_no": {
      const value = typeof a?.value === "boolean" ? a.value : null;
      const note = a?.note ?? "";
      return (
        <div className="stack" style={{ gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[true, false].map((v) => (
              <button key={String(v)} type="button" className={`opt${value === v ? " on" : ""}`} style={{ flex: 1, justifyContent: "center", fontFamily: "var(--font-mono-stack)", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: value === v ? "var(--ink)" : "var(--muted)" }}
                onClick={() => { const nv = value === v ? null : v; setLocal(q.key, { value: nv ?? undefined }); void saveNow(q.key, { value: nv, note }); }}>
                {v ? "Yes" : "No"}
              </button>
            ))}
          </div>
          {value === true && (
            <>
              <p className="help">Say more, if there is more.</p>
              <textarea className="fld" value={note} maxLength={4000} onChange={(e) => { const n = e.target.value; setLocal(q.key, { note: n }); saveDebounced(q.key, { value, note: n }); }} />
            </>
          )}
        </div>
      );
    }
    case "pick_one": {
      const value = typeof a?.value === "string" ? a.value : "";
      return (
        <div className="opts">
          {q.options.map((o) => {
            const on = value === o.id;
            return (
              <label key={o.id} className={`opt${on ? " on" : ""}`} style={{ position: "relative" }}>
                <input type="radio" name={q.key} checked={on} onChange={() => { setLocal(q.key, { value: o.id }); void saveNow(q.key, o.id); }} />
                <span className="radio" />{o.label}
              </label>
            );
          })}
        </div>
      );
    }
    case "pick_many": {
      const value = Array.isArray(a?.value) ? (a.value as string[]) : [];
      return (
        <div className="opts">
          {q.options.map((o) => {
            const on = value.includes(o.id);
            return (
              <label key={o.id} className={`opt${on ? " on" : ""}`} style={{ position: "relative" }}>
                <input type="checkbox" checked={on} onChange={(e) => { const nv = e.target.checked ? [...value, o.id] : value.filter((x) => x !== o.id); setLocal(q.key, { value: nv }); void saveNow(q.key, nv); }} />
                <span className="check">{on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--on-ember)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}</span>
                {o.label}
              </label>
            );
          })}
        </div>
      );
    }
    case "image_choice": {
      const value = Array.isArray(a?.value) ? (a.value as string[]) : [];
      const max = q.max_choices ?? 1;
      return (
        <div className="img-grid">
          {q.options.map((o) => {
            const on = value.includes(o.id);
            return (
              <label key={o.id} className={`pick${on ? " on" : ""}`} style={{ position: "relative" }}>
                <input type="checkbox" checked={on} onChange={() => {
                  let nv: string[];
                  if (on) nv = value.filter((x) => x !== o.id);
                  else if (max === 1) nv = [o.id];
                  else if (value.length >= max) return;
                  else nv = [...value, o.id];
                  setLocal(q.key, { value: nv }); void saveNow(q.key, nv);
                }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${p.libBase}/${encodeURIComponent(o.image)}`} alt="" />
                <span>{o.label}</span>
              </label>
            );
          })}
        </div>
      );
    }
    case "upload": {
      const ids = a?.files ?? [];
      return (
        <UploadField q={q} ids={ids} files={files} p={p} setFiles={setFiles} setLocal={setLocal} setStatus={setStatus} post={post} />
      );
    }
  }
}

/** The two sign-off fields arrive prefilled from the project; write the prefill through once so admin sees it as an answer. */
function SeedPrefill({ fieldKey, prefill, setLocal, saveNow }: { fieldKey: string; prefill: string; setLocal: FieldProps["setLocal"]; saveNow: FieldProps["saveNow"] }) {
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    setLocal(fieldKey, { value: prefill });
    void saveNow(fieldKey, prefill);
  }, [fieldKey, prefill, setLocal, saveNow]);
  return null;
}

function UploadField({ q, ids, files, p, setFiles, setLocal, setStatus, post }: { q: Extract<Question, { type: "upload" }>; ids: string[]; files: Record<string, FileInfo>; p: RendererProps; setFiles: FieldProps["setFiles"]; setLocal: FieldProps["setLocal"]; setStatus: FieldProps["setStatus"]; post: FieldProps["post"] }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true); setNote(null); setStatus({ kind: "saving" });
    const fd = new FormData();
    fd.set("key", q.key);
    Array.from(list).forEach((f) => fd.append("file", f));
    try {
      const res = await fetch(`${p.apiBase}/upload`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; stored?: FileInfo[]; refused?: { name: string; message: string }[] };
      if (!res.ok || !data.ok) { setStatus({ kind: "error", message: data.message ?? "Upload failed." }); setNote(data.message ?? "Upload failed."); return; }
      const stored = data.stored ?? [];
      setFiles((prev) => { const n = { ...prev }; stored.forEach((s) => { n[s.id] = s; }); return n; });
      setLocal(q.key, { files: [...ids, ...stored.map((s) => s.id)] });
      setStatus({ kind: "saved", at: Date.now() });
      if (data.refused && data.refused.length) setNote(data.refused.map((r) => `${r.name}: ${r.message}`).join(" "));
    } catch {
      setStatus({ kind: "error", message: "Upload failed. Check the connection." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    const r = await post("remove-file", { fileId: id });
    if (r.ok) setLocal(q.key, { files: ids.filter((x) => x !== id) });
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="thumb-grid">
        {ids.map((id) => {
          const f = files[id];
          return (
            <div key={id} className="cell">
              {f?.hasThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${p.fileBase}/${id}?thumb`} alt="" />
              ) : null}
              <span className="name">{f?.name ?? "file"}</span>
              <button type="button" aria-label="Remove" onClick={() => remove(id)} style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 2, border: "1px solid var(--rule)", background: "var(--ground)", color: "var(--muted)", cursor: "pointer", fontFamily: "var(--font-mono-stack)", fontSize: 12, lineHeight: 1 }}>×</button>
            </div>
          );
        })}
        {ids.length < q.max_files && (
          <label className="add">
            <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/svg+xml,application/pdf,.jpg,.jpeg,.png,.webp,.svg,.pdf" style={{ display: "none" }} onChange={(e) => onFiles(e.target.files)} disabled={busy} />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ember)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span>{busy ? "Sending" : "Add"}</span>
          </label>
        )}
      </div>
      <p className="help">{ids.length} of {q.max_files}. Photos or PDFs, up to 10 MB each.</p>
      {note && <p className="help err">{note}</p>}
    </div>
  );
}

/** True when nothing usable was answered, by the same reading ReadOnlyValue gives it. */
function isEmptyAnswer(q: Question, answers: Answers): boolean {
  const a = answers[q.key];
  if (!a) return true;
  switch (q.type) {
    case "short_text": case "long_text": case "link":
      return !(typeof a.value === "string" && a.value);
    case "yes_no":
      return a.value === undefined;
    case "pick_one":
      return !q.options.some((o) => o.id === a.value);
    case "pick_many": case "image_choice": {
      const ids = Array.isArray(a.value) ? (a.value as string[]) : [];
      return !q.options.some((o) => ids.includes(o.id));
    }
    case "upload":
      return (a.files?.length ?? 0) === 0;
  }
}

/** "Tap to add" only where a tap does something (F-07). */
function ReadOnlyValue({ q, answers, files, editable = false }: { q: Question; answers: Answers; files: Record<string, FileInfo>; editable?: boolean }) {
  const a = answers[q.key];
  const empty = <span style={{ color: "var(--faint)" }}>{editable ? "Not answered. Tap to add." : "Not answered."}</span>;
  if (!a) return empty;
  switch (q.type) {
    case "short_text": case "long_text": case "link":
      return typeof a.value === "string" && a.value ? <span style={{ whiteSpace: "pre-wrap" }}>{a.value}</span> : empty;
    case "yes_no":
      return a.value === undefined ? empty : <span>{a.value ? "Yes" : "No"}{a.note ? `. ${a.note}` : ""}</span>;
    case "pick_one":
      return <span>{q.options.find((o) => o.id === a.value)?.label ?? empty}</span>;
    case "pick_many": case "image_choice": {
      const ids = Array.isArray(a.value) ? (a.value as string[]) : [];
      const labels = q.options.filter((o) => ids.includes(o.id)).map((o) => o.label);
      return labels.length ? <span>{labels.join(", ")}</span> : empty;
    }
    case "upload": {
      const n = a.files?.length ?? 0;
      return n ? <span>{n} {n === 1 ? "file" : "files"}: {a.files!.map((id) => files[id]?.name ?? "file").join(", ")}</span> : empty;
    }
  }
}
