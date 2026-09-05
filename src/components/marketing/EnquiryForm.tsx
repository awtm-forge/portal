"use client";

import { FormEvent, useState } from "react";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

const fallback = "Could not send just now. Email hello@awtmforge.com and we will reply within one working day.";

export function EnquiryForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus({ kind: "error", message: body?.error ?? fallback });
        return;
      }
      form.reset();
      setStatus({ kind: "sent" });
    } catch {
      setStatus({ kind: "error", message: fallback });
    }
  }

  return (
    <form className="enquiry" onSubmit={onSubmit}>
      <label className="field">Name<input type="text" name="name" placeholder="Your name" required maxLength={120} /></label>
      <label className="field">Business and website<input type="text" name="business" placeholder="Brand name or URL" maxLength={200} /></label>
      <label className="field">What is not working<textarea name="problem" placeholder="Traffic is fine, orders are not." required maxLength={4000} /></label>
      <label className="field">Budget you have in mind
        <select name="budget" defaultValue="Not sure yet">
          <option>Not sure yet</option>
          <option>Under ₹1 lakh</option>
          <option>₹1 to 3 lakh</option>
          <option>₹3 to 8 lakh</option>
          <option>Above ₹8 lakh</option>
          <option>International, quote in USD or AED</option>
        </select>
      </label>
      <label className="field">Monthly ad spend, optional
        <select name="adSpend" defaultValue="Prefer not to say">
          <option>Prefer not to say</option>
          <option>Under ₹50k</option>
          <option>₹50k to ₹1L</option>
          <option>₹1L to ₹3L</option>
          <option>₹3L to ₹8L</option>
          <option>Above ₹8L</option>
          <option>We don&apos;t run ads</option>
        </select>
      </label>
      <label className="field">How do we reach you<input type="text" name="contact" placeholder="WhatsApp number or email" required maxLength={200} /></label>
      <button className="btn solid" type="submit" disabled={status.kind === "sending"}>
        {status.kind === "sending" ? "Sending" : "Send it"}
      </button>
      {status.kind === "sent" && <span className="note">Got it. We reply within one working day.</span>}
      {status.kind === "error" && <span className="note err">{status.message}</span>}
    </form>
  );
}
