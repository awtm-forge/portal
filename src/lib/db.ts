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
    connectionLimit: 5,
  };
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function client(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionConfig()) });
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
