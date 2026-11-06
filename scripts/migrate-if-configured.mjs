// Runs prisma migrate deploy when DATABASE_URL is set, and skips quietly when
// it is not, so the marketing-only deploy builds without a database.
//
// Hostinger's build host stopped letting Prisma's schema engine binary run
// (EACCES, 29 Oct 2026), so when the CLI cannot, the pending migrations are
// applied here over the same mariadb driver the app uses, and recorded in
// _prisma_migrations exactly as the CLI would record them.
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL not set, skipping migrations");
  process.exit(0);
}
const r = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
if (r.status === 0) process.exit(0);
console.log("prisma migrate deploy could not run here; applying pending migrations directly");

/** Statements of one migration file: comment lines dropped, split on the semicolon that ends each one. */
export function statements(sql) {
  return sql.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n").split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
}

const { default: mariadb } = await import("mariadb");
const u = new URL(process.env.DATABASE_URL);
const conn = await mariadb.createConnection({ host: u.hostname, port: u.port ? Number(u.port) : 3306, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.slice(1) });
try {
  await conn.query(`CREATE TABLE IF NOT EXISTS \`_prisma_migrations\` (
    \`id\` VARCHAR(36) NOT NULL PRIMARY KEY, \`checksum\` VARCHAR(64) NOT NULL, \`finished_at\` DATETIME(3) NULL,
    \`migration_name\` VARCHAR(255) NOT NULL, \`logs\` TEXT NULL, \`rolled_back_at\` DATETIME(3) NULL,
    \`started_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`applied_steps_count\` INTEGER UNSIGNED NOT NULL DEFAULT 0
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const rows = await conn.query("SELECT migration_name, finished_at, rolled_back_at FROM `_prisma_migrations`");
  const broken = rows.find((m) => !m.finished_at && !m.rolled_back_at);
  if (broken) { console.error(`Migration ${broken.migration_name} failed earlier and must be resolved by hand (prisma migrate resolve).`); process.exit(1); }
  const applied = new Set(rows.filter((m) => m.finished_at).map((m) => m.migration_name));
  const dir = "prisma/migrations";
  const pending = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !applied.has(d.name)).map((d) => d.name).sort();
  for (const name of pending) {
    const sql = readFileSync(join(dir, name, "migration.sql"), "utf8");
    const id = randomUUID();
    await conn.query("INSERT INTO `_prisma_migrations` (id, checksum, migration_name) VALUES (?, ?, ?)", [id, createHash("sha256").update(sql).digest("hex"), name]);
    let steps = 0;
    try {
      for (const s of statements(sql)) { await conn.query(s); steps++; }
    } catch (e) {
      await conn.query("UPDATE `_prisma_migrations` SET logs=?, applied_steps_count=? WHERE id=?", [String(e.message).slice(0, 60000), steps, id]);
      console.error(`Migration ${name} failed at statement ${steps + 1}: ${e.message}`); process.exit(1);
    }
    await conn.query("UPDATE `_prisma_migrations` SET finished_at=NOW(3), applied_steps_count=? WHERE id=?", [steps, id]);
    console.log(`Applied ${name} (${steps} statements)`);
  }
  console.log(pending.length ? `${pending.length} migration(s) applied` : "No pending migrations");
} finally { await conn.end(); }
