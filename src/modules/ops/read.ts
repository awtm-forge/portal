import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { adminBase, clientBase } from "@/lib/hosts";

/**
 * What the ops console (ops.awtmforge.com) may read from the portal: clients,
 * their projects, where each one stands, what has been invoiced and paid, and
 * recent activity. Read-only, by design: every action a client can see stays
 * in the portal, where the evidence rules live (27 Oct 2026).
 *
 * Money crosses as integer paise, as strings, because BigInt has no JSON form
 * and a float never touches an amount. Client tokens never leave: the links
 * handed over are admin pages, never a client's private link.
 */
export function opsKeyOk(header: string | null): boolean {
  const want = process.env.OPS_API_KEY ?? "";
  if (!want || !header || header.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(want));
}
const paise = (v: bigint | number | null | undefined) => (v == null ? "0" : v.toString());

const projectShape = {
  id: true, name: true, slug: true, typeOfWork: true, phase: true, weekCount: true, expectedBy: true, kickoffAt: true,
  deliveredAt: true, cancelledAt: true, lastMovedAt: true, createdAt: true, afterDelivery: true,
  agreement: { select: { totalPaise: true, advancePct: true, sentAt: true, agreedAt: true, version: true, startDate: true, launchTargetDate: true } },
  invoices: { select: { id: true, kind: true, number: true, issuedAt: true, totalPaise: true, status: true, paidAt: true } },
  signoffEvents: { select: { kind: true, occurredAt: true, method: true, actorName: true }, orderBy: { occurredAt: "desc" as const } },
  updates: { select: { weekNumber: true, sentAt: true, needByDate: true }, orderBy: { weekNumber: "desc" as const }, take: 1 },
  day30: { select: { unlocksAt: true, openedAt: true, metricAfterSubmittedAt: true } },
} as const;

type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof projectShape }>;
type InvoiceOut = Omit<ProjectRow["invoices"][number], "totalPaise"> & { totalPaise: string };
function shapeProject(p: ProjectRow) {
  const invoices: InvoiceOut[] = p.invoices.map((i) => ({ ...i, totalPaise: paise(i.totalPaise) }));
  const sum = (f: (i: InvoiceOut) => boolean) => invoices.filter(f).reduce((a, i) => a + BigInt(i.totalPaise), 0n).toString();
  return {
    ...p, invoices,
    agreement: p.agreement && { ...p.agreement, totalPaise: paise(p.agreement.totalPaise) },
    invoicedPaise: sum((i) => i.status !== "CANCELLED"), paidPaise: sum((i) => i.status === "PAID"), duePaise: sum((i) => i.status === "ISSUED"),
    agreementSignedAt: p.signoffEvents.find((e) => e.kind === "AGREEMENT")?.occurredAt ?? null,
    deliverySignedAt: p.signoffEvents.find((e) => e.kind === "DELIVERY")?.occurredAt ?? null,
    latestUpdate: p.updates[0] ?? null,
    adminUrl: `${adminBase()}/admin/projects/${p.id}`,
  };
}

export async function listClients() {
  const rows = await db.client.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, businessName: true, location: true, contactName: true, contactEmail: true, contactPhone: true, createdAt: true, linkEmailedAt: true,
      intake: { select: { submittedAt: true, lastSavedAt: true } }, projects: { select: projectShape, orderBy: { createdAt: "desc" } } },
  });
  return rows.map((c) => ({ ...c, intake: c.intake, projects: c.projects.map(shapeProject), adminUrl: `${adminBase()}/admin/clients/${c.id}` }));
}

export async function getClient(id: string) {
  const c = await db.client.findUnique({
    where: { id },
    select: { id: true, businessName: true, location: true, contactName: true, contactEmail: true, contactPhone: true, createdAt: true, linkEmailedAt: true, tokenRotatedAt: true,
      intake: { select: { submittedAt: true, lastSavedAt: true, sectionsDone: true } }, projects: { select: projectShape, orderBy: { createdAt: "desc" } } },
  });
  if (!c) return null;
  const projectIds = c.projects.map((p) => p.id);
  const activity = projectIds.length ? await db.activityEvent.findMany({ where: { projectId: { in: projectIds } }, orderBy: { createdAt: "desc" }, take: 40, select: { type: true, actor: true, createdAt: true, projectId: true } }) : [];
  return { ...c, projects: c.projects.map(shapeProject), activity, adminUrl: `${adminBase()}/admin/clients/${c.id}`, portalHost: clientBase() };
}

export async function summary() {
  const [clients, projects, byPhase, invoices] = await Promise.all([
    db.client.count(), db.project.count(),
    db.project.groupBy({ by: ["phase"], _count: { _all: true } }),
    db.invoice.groupBy({ by: ["status"], _sum: { totalPaise: true }, _count: { _all: true } }),
  ]);
  return {
    clients, projects,
    phases: Object.fromEntries(byPhase.map((r) => [r.phase, r._count._all])),
    invoices: Object.fromEntries(invoices.map((r) => [r.status, { count: r._count._all, totalPaise: paise(r._sum.totalPaise) }])),
  };
}
