import Link from "next/link";
import "@/components/portal/portal.css";

export default function NotFound() {
  return (
    <div style={{ padding: 40 }} className="stack">
      <p className="k">No such project</p>
      <Link href="/admin" className="link-mono" style={{ marginTop: 10 }}>Back to projects</Link>
    </div>
  );
}
