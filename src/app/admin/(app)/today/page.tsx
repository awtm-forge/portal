import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { dayMonth } from "@/lib/dates";
import { requireAdmin } from "@/modules/auth/admin";
import { listTodos } from "@/modules/todos";
import { addTodoAction, removeTodoAction, toggleTodoAction } from "../actions";

type Item = Awaited<ReturnType<typeof listTodos>>["todays"][number];

/**
 * The team's Today list, shared by both admins. Undone items from earlier
 * days sit above today's so nothing is lost. A tick is a form that submits on click,
 * so the page needs no script of its own.
 */
export default async function TodayPage() {
  const admin = await requireAdmin();
  const { stillOpen, todays } = await listTodos();

  const row = (t: Item, dated: boolean) => (
    <li key={t.id} className="between" style={{ padding: "8px 0", borderBottom: "1px solid var(--rule)" }}>
      <form action={toggleTodoAction} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <input type="hidden" name="id" value={t.id} />
        <button type="submit" role="checkbox" aria-checked={t.doneAt !== null} className="link-mono" style={{ textAlign: "left", textDecoration: t.doneAt ? "line-through" : "none", color: t.doneAt ? "var(--faint)" : "var(--ink)", fontFamily: "var(--font-body-stack)", fontSize: 14 }}>
          <span aria-hidden="true" className="mono-sm" style={{ marginRight: 8 }}>{t.doneAt ? "[x]" : "[ ]"}</span>{t.text}
        </button>
        {dated && <span className="mono-sm">{dayMonth(t.day)}</span>}
        {t.client && <Link className="mono-sm" href={`/admin/clients/${t.client.id}`}>{t.client.businessName}</Link>}
      </form>
      <form action={removeTodoAction}>
        <input type="hidden" name="id" value={t.id} />
        <button type="submit" className="link-mono" aria-label={`Remove ${t.text}`}>Remove</button>
      </form>
    </li>
  );

  return (
    <AdminShell active="today" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">Today</h1>
        <p className="a-sub">One list for both of you. Tick it when it is done.</p>
      </div>

      <div className="a-card">
        <form action={addTodoAction} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="a-fld" name="text" aria-label="New item" placeholder="What needs doing today" maxLength={300} required style={{ flex: "1 1 240px" }} />
          <button className="a-btn" type="submit">Add</button>
        </form>

        {stillOpen.length > 0 && (
          <>
            <span className="k ember">Still open</span>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{stillOpen.map((t) => row(t, true))}</ul>
          </>
        )}

        <span className="k">{dayMonth(new Date())}</span>
        {todays.length === 0 ? (
          <p className="help">Nothing on the list yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{todays.map((t) => row(t, false))}</ul>
        )}
      </div>
    </AdminShell>
  );
}
