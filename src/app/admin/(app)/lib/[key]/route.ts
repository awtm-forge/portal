import { currentAdmin } from "@/modules/auth/admin";
import { serveLibraryImage } from "@/lib/intake/handlers";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!(await currentAdmin())) return new Response("Not found", { status: 404 });
  const { key } = await params;
  return serveLibraryImage(key);
}
