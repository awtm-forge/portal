import { notFound, redirect } from "next/navigation";
import { currentClientSession, resolveClient, type ClientByToken } from "@/modules/auth/client";
import { activeProjectFor } from "@/modules/clients";

/**
 * Every client route starts here (ADR 0015). The token names a client, not a
 * project; the session is the client's; the project is whichever of theirs
 * is live. A route that needs a project and finds none sends them back to
 * their page, which says what is happening instead.
 */
export type Scope = { client: ClientByToken; project: NonNullable<Awaited<ReturnType<typeof activeProjectFor>>> };

export async function clientScope(token: string): Promise<ClientByToken> {
  const client = await resolveClient(token);
  if (!client) {
    if (token === "me") redirect("/p/login");
    notFound();
  }
  if (!(await currentClientSession(client.id))) redirect(token === "me" ? "/p/login" : `/p/${token}`);
  return client;
}

export async function projectScope(token: string): Promise<Scope> {
  const client = await clientScope(token);
  const project = await activeProjectFor(client.id);
  if (!project) redirect(`/p/${token}`);
  return { client, project };
}
