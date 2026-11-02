import { db } from "@/lib/db";
import { istParts } from "@/lib/dates";

/**
 * The team's shared Today list. One list for both admins; nothing on it is
 * evidence. "Today" is the Kolkata calendar date, stored as a plain DATE at
 * UTC midnight so the column and the comparison agree.
 */
export function today(now: Date = new Date()): Date {
  const { year, month, day } = istParts(now);
  return new Date(Date.UTC(year, month - 1, day));
}

export async function listTodos() {
  const day = today();
  const rows = await db.todo.findMany({
    where: { OR: [{ day }, { day: { lt: day }, doneAt: null }] },
    orderBy: [{ day: "asc" }, { createdAt: "asc" }],
    include: { client: { select: { id: true, businessName: true } } },
  });
  return {
    stillOpen: rows.filter((t) => t.day < day),
    todays: rows.filter((t) => t.day.getTime() === day.getTime()),
  };
}

export async function addTodo(text: string, clientId: string | null): Promise<void> {
  await db.todo.create({ data: { text, day: today(), clientId } });
}

export async function toggleTodo(id: string): Promise<void> {
  const row = await db.todo.findUnique({ where: { id }, select: { doneAt: true } });
  if (!row) return;
  await db.todo.update({ where: { id }, data: { doneAt: row.doneAt ? null : new Date() } });
}

export async function removeTodo(id: string): Promise<void> {
  await db.todo.deleteMany({ where: { id } });
}
