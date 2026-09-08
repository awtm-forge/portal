import "@/components/portal/portal.css";

export default function ProjectNotFound() {
  return (
    <div className="c-page">
      <div className="c-head"><span className="c-brand">awtm <b>forge</b></span></div>
      <div style={{ padding: "38px 20px" }} className="stack">
        <p className="k">This link is not the one</p>
        <h1 className="c-title" style={{ marginTop: 9 }}>We cannot find that page</h1>
        <p className="c-sub" style={{ marginTop: 10 }}>
          It may have been replaced by a newer one, or a character may have gone missing on its way to you. Neither is your fault and neither is a problem.
        </p>
        <p className="c-sub" style={{ marginTop: 10 }}>Message Rahul on WhatsApp and he will send the current link straight back.</p>
      </div>
    </div>
  );
}
