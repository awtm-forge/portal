import "./portal.css";

export function ClientShell({ businessName, children }: { businessName: string; children: React.ReactNode }) {
  return (
    <div className="c-page">
      <div className="c-head">
        <span className="c-brand">awtm <b>forge</b></span>
        <span className="k">{businessName}</span>
      </div>
      {children}
      <div className="c-foot">
        <p>Stuck on anything, or just want to talk it through, message Rahul on WhatsApp.</p>
        <p>This page is yours and the link does not expire. Nothing here will ever ask you for a password.</p>
      </div>
    </div>
  );
}
