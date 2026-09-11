"use server";

import { refreshTo } from "@/lib/admin-nav";
import { z } from "zod";
import { AfterDelivery } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { fromIsoDate } from "@/lib/dates";
import { parseRupeesToPaise } from "@/lib/money";
import { requireAdmin } from "@/modules/auth/admin";
import { AgreementFrozen, overrideIntakeGate, saveDraft, send } from "@/modules/agreements";
import { emit } from "@/modules/events";
import "@/modules/notifications/register";

export type EditorState = { message?: string; ok?: string };

const line = z.string().trim().max(500);

/** Deliverables and milestones arrive as parallel arrays from the form. */
function readDeliverables(formData: FormData) {
  const texts = formData.getAll("deliverable_text").map(String);
  const checks = formData.getAll("deliverable_check").map(String);
  return texts
    .map((text, i) => ({ key: `d${i + 1}`, text: text.trim(), how_to_check: (checks[i] ?? "").trim() }))
    .filter((d) => d.text !== "");
}

function readMilestones(formData: FormData) {
  const labels = formData.getAll("milestone_label").map(String);
  const dates = formData.getAll("milestone_date").map(String);
  return labels
    .map((label, i) => ({ label: label.trim(), date: (dates[i] ?? "").trim() }))
    .filter((m) => m.label !== "" && m.date !== "");
}

const projectFields = z.object({
  weekCount: z.string().trim().max(3),
  metricName: line,
  metricBaselineValue: line,
  afterDelivery: z.enum(["RETAINER", "HANDOVER", "UNDECIDED"]),
  retainerTier: line,
  retainerNamedPerson: line,
  retainerResponseTime: line,
  handoverDocUrl: line,
});

export async function saveAgreementAction(_prev: EditorState, formData: FormData): Promise<EditorState> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) refreshTo("/admin");

  const totalPaise = parseRupeesToPaise(String(formData.get("total") ?? ""));
  if (totalPaise === null) return { message: "The price needs to be a number of rupees, for example 4,80,000." };
  const internalCostPaise = parseRupeesToPaise(String(formData.get("internalCost") ?? "0")) ?? 0n;
  const advancePct = Number(String(formData.get("advancePct") ?? ""));
  if (!Number.isInteger(advancePct) || advancePct < 0 || advancePct > 100) {
    return { message: "The advance percentage needs to be a whole number from 0 to 100." };
  }
  const deliverables = readDeliverables(formData);
  if (deliverables.length === 0) return { message: "At least one deliverable, with how the client checks it." };

  const p = projectFields.safeParse(Object.fromEntries(formData.entries()));
  if (!p.success) return { message: "Something in the after-delivery block did not read. Check the fields." };

  try {
    await saveDraft(projectId, {
      scope: String(formData.get("scope") ?? "").trim(),
      deliverables,
      notIncluded: String(formData.get("notIncluded") ?? "").trim(),
      startDate: fromIsoDate(String(formData.get("startDate") ?? "")),
      launchTargetDate: fromIsoDate(String(formData.get("launchTargetDate") ?? "")),
      milestones: readMilestones(formData),
      totalPaise,
      advancePct,
      howWeWork: String(formData.get("howWeWork") ?? "").trim(),
      ifWeMiss: String(formData.get("ifWeMiss") ?? "").trim(),
      afterDeliveryOffer: String(formData.get("afterDeliveryOffer") ?? "").trim(),
      internalCostPaise,
      internalNotes: String(formData.get("internalNotes") ?? "").trim(),
    });
  } catch (error) {
    if (error instanceof AgreementFrozen) return { message: error.message };
    throw error;
  }

  // QUESTIONS.md Q2: the project's timeline and outcome fields are edited here,
  // because this is the moment they are decided.
  const weeks = Number(p.data.weekCount);
  await db.project.update({
    where: { id: projectId },
    data: {
      weekCount: Number.isInteger(weeks) && weeks > 0 ? weeks : null,
      metricName: p.data.metricName || null,
      metricBaselineValue: p.data.metricBaselineValue || null,
      metricBaselineCapturedAt: p.data.metricBaselineValue ? (project.metricBaselineCapturedAt ?? new Date()) : null,
      afterDelivery: p.data.afterDelivery as AfterDelivery,
      retainerTier: p.data.retainerTier || null,
      retainerNamedPerson: p.data.retainerNamedPerson || null,
      retainerResponseTime: p.data.retainerResponseTime || null,
      handoverDocUrl: p.data.handoverDocUrl || null,
    },
  });

  if (String(formData.get("intent")) === "send") {
    const result = await send(projectId);
    if (!result.ok) {
      const why: Record<string, string> = {
        no_agreement: "Write the agreement before sending it.",
        intake_open: "The questionnaire is not submitted yet. Override it below if you took the answers on a call.",
        frozen: "This agreement was already agreed and cannot be re-sent.",
        wrong_phase: "This project is not waiting for an agreement to be sent.",
      };
      return { message: why[result.reason] ?? "It could not be sent." };
    }
    await emit({
      type: "agreement.sent",
      projectId,
      actor: "team",
      payload: { version: result.version, projectName: project.name },
    });
    refreshTo(`/admin/projects/${projectId}`);
  }

  return { ok: "Saved." };
}

export async function overrideIntakeAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  await overrideIntakeGate(projectId, admin.email);
  refreshTo(`/admin/projects/${projectId}/agreement`);
}
