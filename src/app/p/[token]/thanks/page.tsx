import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientShell } from "@/components/portal/ClientShell";
import { dayMonthYear } from "@/lib/dates";
import { projectScope } from "../scope";
import { ThanksForm } from "./ThanksForm";

/**
 * Acceptance criterion 24: 404 before the delivery sign-off, renders after it.
 * The redirect here happens once, straight after signing off; the page itself
 * stays reachable, and shows a closed state once they have answered. Making it
 * 404 after answering would break criterion 24 depending on test order.
 */
export default async function ThanksPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { client, project } = await projectScope(token);
  if (!project.deliveredAt) notFound();

  const answered = project.thanksSeenAt !== null;

  return (
    <ClientShell businessName={client.businessName}>
      <div style={{ padding: "38px 20px 20px" }} className="stack">
        <p className="k ember">Delivered {dayMonthYear(project.deliveredAt)}</p>
        <h1 className="c-title" style={{ marginTop: 10 }}>Thank you. It is delivered.</h1>
        <p className="c-sub" style={{ marginTop: 10 }}>
          {answered
            ? "You have already sent this. Nothing else is needed."
            : "Two things, both optional, and then you are done. We will come back to you once, a month from now, to ask what changed."}
        </p>
      </div>

      {answered ? (
        <div style={{ padding: "0 20px" }}>
          <Link className="btn-full ghost" href={`/p/${token}`}>Back to your project</Link>
        </div>
      ) : (
        <ThanksForm token={token} />
      )}
    </ClientShell>
  );
}
