// Creates or refreshes one of the two admin accounts and prints a one-time
// setup link. It never generates, prints, or asks for a password: the person
// sets their own by opening the link (CLAUDE.md section 4).
//
//   npm run admin:create -- rahul@zyphextech.com "zekst"
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

const SETUP_HOURS = 48;

async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email || !name) {
    console.error('usage: npm run admin:create -- <email> "<name>"');
    process.exit(2);
  }

  const u = new URL(process.env.DATABASE_URL ?? "");
  const db = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.slice(1),
      connectionLimit: 2,
    }),
  });

  const lower = email.toLowerCase();
  const others = await db.adminUser.count({ where: { NOT: { email: lower } } });
  if (others >= 2) {
    console.error("Two admin accounts already exist. PORTAL-SPEC 6.6 allows two.");
    process.exit(2);
  }

  const token = randomBytes(32).toString("base64url");
  const setupTokenHash = createHash("sha256").update(token).digest("hex");
  const setupExpiresAt = new Date(Date.now() + SETUP_HOURS * 60 * 60 * 1000);

  await db.adminUser.upsert({
    where: { email: lower },
    create: { email: lower, name, setupTokenHash, setupExpiresAt },
    update: { name, setupTokenHash, setupExpiresAt, setupLinkUsedAt: null },
  });
  await db.$disconnect();

  const base = (process.env.APP_URL ?? "http://localhost:3200").replace(/\/$/, "");
  console.log("");
  console.log(`Admin ${lower} is ready. Open this link within ${SETUP_HOURS} hours and choose a password:`);
  console.log("");
  console.log(`  ${base}/admin/setup/${token}`);
  console.log("");
  console.log("The link works once. Running this command again replaces it, which is also how");
  console.log("a forgotten password is reset. Nobody else should ever see this link.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
