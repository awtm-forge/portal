/**
 * Lighthouse over the main screens of both portals, signed in, against a local
 * server on the local database. Prints a markdown table and keeps the JSON
 * reports beside it.
 *
 *   npx tsx scripts/ux-audit/lighthouse.ts http://127.0.0.1:3210 docs/ux-overhaul/audit/lighthouse-before
 *
 * Sessions are planted straight into the database for the run (a client
 * session for the seed client, an admin session for a throwaway admin) and
 * removed at the end. Client screens run under Lighthouse's default mobile
 * emulation; admin screens under the desktop preset, which is where the team
 * uses them.
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { closeDb, freshLink, query, SEED_SLUG, setPhase } from "../../tests/e2e/fixtures";

const base = process.argv[2] ?? "http://127.0.0.1:3210";
const out = process.argv[3] ?? "docs/ux-overhaul/audit/lighthouse-before";
const ADMIN_EMAIL = "ux-lh@example.invalid";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

type Target = { name: string; path: string; cookie?: string; desktop?: boolean };

async function plant() {
  const seed = await freshLink(SEED_SLUG);
  const [proj] = await query<{ phase: string }>("SELECT phase FROM Project WHERE id = ?", [seed.projectId]);
  await setPhase(seed.projectId, "BUILDING");
  const ct = randomBytes(32).toString("base64url");
  await query("INSERT INTO ClientSession (id, clientId, tokenHash, createdAt, expiresAt, lastSeenAt, userAgent) VALUES (?, ?, ?, NOW(3), DATE_ADD(NOW(3), INTERVAL 1 DAY), NOW(3), 'lighthouse')", [`lh${Date.now()}`, seed.clientId, sha(ct)]);
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  const adminId = `lha${Date.now()}`;
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, 'Lighthouse', 'x', NOW(3))", [adminId, ADMIN_EMAIL]);
  const at = randomBytes(32).toString("base64url");
  await query("INSERT INTO AdminSession (id, tokenHash, adminUserId, createdAt, expiresAt, lastSeenAt) VALUES (?, ?, ?, NOW(3), DATE_ADD(NOW(3), INTERVAL 1 DAY), NOW(3))", [`lhs${Date.now()}`, sha(at), adminId]);
  return { seed, phaseBefore: proj.phase, clientCookie: `awtm_c_${seed.clientId}=${ct}`, adminCookie: `awtm_admin=${at}`, adminId };
}

function run(t: Target, i: number) {
  const file = `${out}/${String(i).padStart(2, "0")}-${t.name}.json`;
  const headers = `${out}/headers-${i}.json`;
  writeFileSync(headers, JSON.stringify(t.cookie ? { Cookie: t.cookie } : {}));
  const args = ["--yes", "lighthouse@12.8.2", base + t.path, "--quiet", "--chrome-flags=--headless=new", "--output=json", `--output-path=${file}`,
    "--only-categories=performance,accessibility,best-practices", `--extra-headers=${headers}`];
  if (t.desktop) args.push("--preset=desktop");
  const r = spawnSync("npx", args, { stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, CHROME_PATH: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }, timeout: 180_000 });
  if (r.status !== 0) return { name: t.name, error: `exit ${r.status}` };
  const j = JSON.parse(readFileSync(file, "utf8"));
  const c = j.categories;
  const a = j.audits;
  const ms = (id: string) => Math.round(a[id]?.numericValue ?? -1);
  const failing = Object.values(a as Record<string, { id: string; title: string; score: number | null; scoreDisplayMode: string }>)
    .filter((x) => x.score !== null && x.score < 1 && (c.accessibility.auditRefs as { id: string }[]).some((r) => r.id === x.id))
    .map((x) => x.id);
  return {
    name: t.name, url: t.path, mode: t.desktop ? "desktop" : "mobile",
    perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100), bp: Math.round(c["best-practices"].score * 100),
    fcp: ms("first-contentful-paint"), lcp: ms("largest-contentful-paint"), tbt: ms("total-blocking-time"), cls: Number((a["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(3)), si: ms("speed-index"),
    a11yFailing: failing,
  };
}

async function main() {
  mkdirSync(out, { recursive: true });
  const p = await plant();
  const targets: Target[] = [
    { name: "way-in", path: "/" },
    { name: "client-login", path: "/p/login" },
    { name: "client-code", path: `/p/${p.seed.token}` },
    { name: "client-home", path: `/p/${p.seed.token}`, cookie: p.clientCookie },
    { name: "client-agreement", path: `/p/${p.seed.token}/agreement`, cookie: p.clientCookie },
    { name: "client-questionnaire", path: `/p/${p.seed.token}/intake`, cookie: p.clientCookie },
    { name: "client-invoices", path: `/p/${p.seed.token}/invoices`, cookie: p.clientCookie },
    { name: "admin-login", path: "/admin/login", desktop: true },
    { name: "admin-dashboard", path: "/admin", cookie: p.adminCookie, desktop: true },
    { name: "admin-project", path: `/admin/projects/${p.seed.projectId}`, cookie: p.adminCookie, desktop: true },
    { name: "admin-client", path: `/admin/clients/${p.seed.clientId}`, cookie: p.adminCookie, desktop: true },
    { name: "admin-agreement-editor", path: `/admin/projects/${p.seed.projectId}/agreement`, cookie: p.adminCookie, desktop: true },
  ];
  const rows = targets.map((t, i) => run(t, i));
  await setPhase(p.seed.projectId, p.phaseBefore);
  await query("DELETE FROM ClientSession WHERE userAgent = 'lighthouse'");
  await query("DELETE FROM AdminSession WHERE adminUserId = ?", [p.adminId]);
  await query("DELETE FROM AdminUser WHERE id = ?", [p.adminId]);
  await closeDb();
  console.log("| Screen | Mode | Perf | A11y | Best practices | FCP ms | LCP ms | TBT ms | CLS | Speed index ms | Failing a11y audits |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    if ("error" in r) { console.log(`| ${r.name} | | ${r.error} | | | | | | | | |`); continue; }
    console.log(`| ${r.name} | ${r.mode} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.fcp} | ${r.lcp} | ${r.tbt} | ${r.cls} | ${r.si} | ${r.a11yFailing.join(", ") || "none"} |`);
  }
  writeFileSync(`${out}/summary.json`, JSON.stringify(rows, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
