// Creates or updates one of the two admin accounts. The password is read from
// the terminal with echo off, or from stdin when piped. It is never taken from
// an argument, a file, or an environment variable.
//
//   npm run admin:create -- rahul@awtmforge.com "Rahul"
import "dotenv/config";
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (c) => (data += c));
      process.stdin.on("end", () => resolve(data.replace(/\r?\n$/, "")));
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const r = rl as unknown as { _writeToOutput: (s: string) => void };
    const original = r._writeToOutput;
    r._writeToOutput = (s: string) => { if (s.includes(prompt)) original.call(rl, s); };
    rl.question(prompt, (answer) => {
      r._writeToOutput = original;
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email || !name) {
    console.error('usage: npm run admin:create -- <email> "<name>"');
    process.exit(2);
  }
  const password = await askHidden("Password (not shown): ");
  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(2);
  }
  const u = new URL(process.env.DATABASE_URL ?? "");
  const db = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: u.hostname, port: Number(u.port || 3306), user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password), database: u.pathname.slice(1), connectionLimit: 2,
    }),
  });
  const count = await db.adminUser.count({ where: { NOT: { email: email.toLowerCase() } } });
  if (count >= 2) {
    console.error("Two admin accounts already exist. PORTAL-SPEC 6.6 allows two.");
    process.exit(2);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await db.adminUser.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), name, passwordHash },
    update: { name, passwordHash },
  });
  await db.$disconnect();
  console.log(`Admin ${email} is ready.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
