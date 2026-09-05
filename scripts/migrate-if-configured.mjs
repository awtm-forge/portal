// Runs prisma migrate deploy when DATABASE_URL is set, and skips quietly when
// it is not, so the marketing-only deploy builds without a database.
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL not set, skipping migrations");
  process.exit(0);
}
const r = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
process.exit(r.status ?? 1);
