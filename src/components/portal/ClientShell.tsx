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
        <p>Anything at all, message Rahul on WhatsApp.</p>
        <p>This page is yours. The link does not expire.</p>
      </div>
    </div>
  );
}
