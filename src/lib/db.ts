import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

function connectionConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    // Each interactive transaction holds a connection. The numbering test
    // issues twenty at once; production is one node with two people on it.
    connectionLimit: 10,
  };
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Append-only evidence (PORTAL-SPEC 5.12, acceptance criterion 16,
 * docs/DATA-MODEL.md). These tables have no update or delete path anywhere in
 * the system, so the guard lives at the client rather than in each module: a
 * new screen cannot get around it by writing its own query.
 */
const NO_WRITE_BACK = new Set(["SignoffEvent", "AgreementNote"]);
const NO_DELETE = new Set(["SignoffEvent", "AgreementNote", "Invoice", "ReviewRound"]);
const MUTATIONS = new Set(["update", "updateMany", "upsert", "delete", "deleteMany"]);

/** An issued invoice keeps its number and its amounts. Only payment moves. */
const INVOICE_UPDATABLE = new Set(["status", "paidAt", "paidReference", "paymentMethod"]);

export class AppendOnly extends Error {
  constructor(model: string, operation: string) {
    super(`${model} is append only: ${operation} is not a thing this system does.`);
    this.name = "AppendOnly";
  }
}

function guard(model: string | undefined, operation: string, args: unknown): void {
  if (!model || !MUTATIONS.has(operation)) return;
  const isDelete = operation === "delete" || operation === "deleteMany";
  if (isDelete && NO_DELETE.has(model)) throw new AppendOnly(model, operation);
  if (!isDelete && NO_WRITE_BACK.has(model)) throw new AppendOnly(model, operation);
  if (!isDelete && model === "Invoice") {
    const data = (args as { data?: Record<string, unknown> } | undefined)?.data ?? {};
    for (const field of Object.keys(data)) {
      if (!INVOICE_UPDATABLE.has(field)) {
        throw new AppendOnly(model, `${operation} of ${field} on an issued invoice`);
      }
    }
  }
}

function client(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const base = new PrismaClient({ adapter: new PrismaMariaDb(connectionConfig()) });
    globalForPrisma.prisma = base.$extends({
      query: {
        $allModels: {
          $allOperations({ model, operation, args, query }) {
            guard(model, operation, args);
            return query(args);
          },
        },
      },
    }) as unknown as PrismaClient;
  }
  return globalForPrisma.prisma;
}

/**
 * Created on first use, not at import, so a build with no DATABASE_URL (the
 * marketing-only deploy) and a unit test that never touches the database
 * can import modules that mention it.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const c = client();
    const value = Reflect.get(c, prop, receiver);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
