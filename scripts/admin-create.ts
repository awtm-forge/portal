// Creates or refreshes one of the two admin accounts and prints a one-time
// setup link. It never generates, prints, or asks for a password: the person
// sets their own by opening the link (CLAUDE.md section 4).
//
//   npm run admin:create -- rahul@awtmforge.com "Rahul"
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { adminBase } from "../src/lib/hosts";

const SETUP_HOURS = 48;

async function main() {
  // Arguments first, environment second. Hostinger's panel can run an npm
  // script but not pass arguments to it, and the panel is the only way in on
  // a host where SSH has no Node on the PATH. Setting two variables there and
  // pressing run has to work, or a fresh deploy has no way to make its first
  // account.
  const [argEmail, argName] = process.argv.slice(2);
  const email = argEmail || process.env.ADMIN_EMAIL;
  const name = argName || process.env.ADMIN_NAME;
  if (!email || !name) {
    console.error('usage: npm run admin:create -- <email> "<name>"');
    console.error("   or: set ADMIN_EMAIL and ADMIN_NAME and run it with no arguments");
    process.exit(2);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set in this shell. Run it from the panel, which has");
    console.error("the app's own environment, or prefix it with the value from hPanel.");
    process.exit(2);
  }
  const u = new URL(process.env.DATABASE_URL);
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

  // The admin host, not APP_URL. Once the two hosts are split (ADR 0013),
  // APP_URL is where clients land and it answers 404 for /admin by design, so
  // a setup link built from it would be dead on arrival.
  const base = adminBase();
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
