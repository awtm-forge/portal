import { db } from "@/lib/db";
import type { FileInfo } from "@/components/intake/IntakeRenderer";

export async function fileInfoMap(projectId: string): Promise<Record<string, FileInfo>> {
  const rows = await db.intakeFile.findMany({ where: { projectId }, select: { id: true, originalName: true, mimeType: true, thumbPath: true } });
  const map: Record<string, FileInfo> = {};
  for (const r of rows) map[r.id] = { id: r.id, name: r.originalName, mime: r.mimeType, hasThumb: !!r.thumbPath };
  return map;
}
