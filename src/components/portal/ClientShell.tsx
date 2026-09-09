import "./portal.css";

/**
 * Every client page sits in this. The shell spans the window and the content
 * keeps a readable measure inside it, so the page works on a laptop as well
 * as a phone (portal.css, the client shell block).
 */
export function ClientShell({
  businessName,
  wide = false,
  children,
}: {
  businessName: string;
  /** The questionnaire, which is a form and wants more room than prose. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`p-shell${wide ? " p-wide" : ""}`}>
      <header className="p-head">
        <div className="p-head-in">
          <span className="c-brand">awtm <b>forge</b></span>
          <span className="k">{businessName}</span>
        </div>
      </header>
      <main className="p-body">{children}</main>
      <footer className="p-foot">
        <div className="p-foot-in">
          <p>Stuck on anything, or just want to talk it through, message Rahul on WhatsApp.</p>
          <p>This page is yours and the link does not expire. Nothing here will ever ask you for a password.</p>
        </div>
      </footer>
    </div>
  );
}
