/**
 * The client home page in every state it can be in, at three widths, in both
 * themes, into docs/ux-overhaul/audit/client-home/ plus a contact sheet.
 *
 * It drives the database rather than mocking anything, so what is in the
 * pictures is what a client would see. Everything it changes is put back at
 * the end, including the seed project's phase, and the throwaway client it
 * makes for the four states that need someone with no project yet is deleted.
 *
 * Run it against a server on PORT with the local database up:
 *   npx tsx scripts/ux-audit/client-home.ts
 */
import { config } from "dotenv";
config({ path: `${process.cwd()}/.env`, quiet: true });

import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type BrowserContext } from "@playwright/test";
import { closeDb, freshLink, query, SEED_SLUG } from "../../tests/e2e/fixtures";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3200";
/** Cookies are per host, so they follow whichever one the run is pointed at. */
const HOST = new URL(BASE).hostname;
const OUT = `${process.cwd()}/docs/ux-overhaul/audit/client-home`;
const WIDTHS = [
  { name: "390", width: 390, height: 900, mobile: true },
  { name: "768", width: 768, height: 1000, mobile: false },
  { name: "1440", width: 1440, height: 1000, mobile: false },
];
const THEMES = ["dark", "light"] as const;
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;

type Shot = { key: string; note: string; setup: () => Promise<void>; useSpare?: boolean };

let seed = { token: "", projectId: "", clientId: "" };
let spare = { token: "", clientId: "", cookie: "" };
let seedCookie = "";

async function sql(text: string, values: unknown[] = []) {
  await query(text, values);
}

/** A signed-in session for a client, so no screenshot has to show a code box. */
async function session(clientId: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await sql(
    "INSERT INTO ClientSession (id, clientId, tokenHash, createdAt, expiresAt, lastSeenAt) VALUES (?, ?, ?, NOW(3), DATE_ADD(NOW(3), INTERVAL 6 HOUR), NOW(3))",
    [`shot${Math.random().toString(36).slice(2, 10)}`, clientId, createHash("sha256").update(raw).digest("hex")],
  );
  return `awtm_c_${clientId}=${raw}`;
}

/** The project's own state, reset before each shot so they cannot bleed. */
async function resetProject() {
  await sql(
    "UPDATE Project SET phase='BUILDING', deliveredAt=NULL, thanksSeenAt=NULL, cancelledAt=NULL, cancelReason=NULL, expectedBy=NULL, lastMovedAt=NOW(3) WHERE id=?",
    [seed.projectId],
  );
  await sql("DELETE FROM Day30 WHERE projectId=?", [seed.projectId]);
  await sql("UPDATE ReviewRound SET outcome='ACCEPTED' WHERE projectId=?", [seed.projectId]);
  await sql("UPDATE Agreement SET version=1 WHERE projectId=?", [seed.projectId]);
}

async function phase(to: string) {
  await sql("UPDATE Project SET phase=? WHERE id=?", [to, seed.projectId]);
}

const SHOTS: Shot[] = [
  {
    key: "questionnaire-writing",
    note: "We are writing your questionnaire. Nothing needed from you yet.",
    useSpare: true,
    setup: async () => {
      await sql("DELETE FROM Intake WHERE clientId=?", [spare.clientId]);
    },
  },
  {
    key: "questionnaire-ready",
    note: "The questionnaire is up and untouched. Action needed.",
    useSpare: true,
    setup: async () => {
      await copyIntakeToSpare({ sectionsDone: "[]", submitted: false });
    },
  },
  {
    key: "questionnaire-resumed",
    note: "Two sections in, saved. Action needed, and it says how far along.",
    useSpare: true,
    setup: async () => {
      await copyIntakeToSpare({ sectionsDone: '["business","customers"]', submitted: false });
    },
  },
  {
    key: "questionnaire-submitted",
    note: "Sent, and no project made yet. Nothing needed from you.",
    useSpare: true,
    setup: async () => {
      await copyIntakeToSpare({ sectionsDone: "[]", submitted: true });
    },
  },
  {
    key: "agreement-preparing",
    note: "We are writing the agreement. Nothing needed, with a date.",
    setup: async () => {
      await phase("AGREEMENT_DRAFT");
      await sql("UPDATE Project SET expectedBy=DATE_ADD(NOW(3), INTERVAL 3 DAY) WHERE id=?", [seed.projectId]);
    },
  },
  {
    key: "agreement-changes",
    note: "They said something was off. We are changing it.",
    setup: async () => {
      await phase("AGREEMENT_DRAFT");
      await sql("UPDATE Agreement SET version=2 WHERE projectId=?", [seed.projectId]);
      await sql("UPDATE Project SET expectedBy=DATE_ADD(NOW(3), INTERVAL 2 DAY) WHERE id=?", [seed.projectId]);
    },
  },
  {
    key: "agreement-ready",
    note: "The agreement is with them. Action needed.",
    setup: async () => { await phase("AGREEMENT_SENT"); },
  },
  {
    key: "agreement-agreed",
    note: "Agreed, kickoff to come. Nothing needed.",
    setup: async () => {
      await phase("AGREED");
      await sql("UPDATE Project SET expectedBy=DATE_ADD(NOW(3), INTERVAL 5 DAY) WHERE id=?", [seed.projectId]);
    },
  },
  {
    key: "build-dated",
    note: "Building, with a date for the next thing they can open.",
    setup: async () => {
      await phase("BUILDING");
      await sql("UPDATE Project SET expectedBy=DATE_ADD(NOW(3), INTERVAL 4 DAY) WHERE id=?", [seed.projectId]);
    },
  },
  {
    key: "build-undated",
    note: "Building, with no date promised. The line is dropped, not faked.",
    setup: async () => { await phase("BUILDING"); },
  },
  {
    key: "build-stopped",
    note: "Closed early, with the date. It asks for nothing.",
    setup: async () => {
      await phase("CANCELLED");
      await sql("UPDATE Project SET cancelledAt=NOW(3), cancelReason='The client put the rebuild on hold' WHERE id=?", [seed.projectId]);
    },
  },
  {
    key: "delivery-ready",
    note: "The finished work is with them. Action needed.",
    setup: async () => {
      await phase("IN_REVIEW");
      await sql("UPDATE ReviewRound SET outcome='OPEN' WHERE projectId=? ORDER BY roundNumber DESC LIMIT 1", [seed.projectId]);
    },
  },
  {
    key: "delivery-changes",
    note: "They sent it back. We are making the changes.",
    setup: async () => {
      await phase("BUILDING");
      await sql("UPDATE ReviewRound SET outcome='CHANGES_REQUESTED' WHERE projectId=? ORDER BY roundNumber DESC LIMIT 1", [seed.projectId]);
      await sql("UPDATE Project SET expectedBy=DATE_ADD(NOW(3), INTERVAL 6 DAY) WHERE id=?", [seed.projectId]);
    },
  },
  {
    key: "delivery-done",
    note: "Signed off, with no check-in on the books. Done.",
    setup: async () => {
      await phase("DELIVERED");
      await sql("UPDATE Project SET deliveredAt=NOW(3), thanksSeenAt=NOW(3) WHERE id=?", [seed.projectId]);
    },
  },
  {
    key: "checkin-waiting",
    note: "Delivered, and the check-in has a date. Nothing needed.",
    setup: async () => {
      await phase("DELIVERED");
      await sql("UPDATE Project SET deliveredAt=NOW(3), thanksSeenAt=NOW(3) WHERE id=?", [seed.projectId]);
      await sql(
        "INSERT INTO Day30 (id, projectId, unlocksAt, frictionNotes) VALUES (?, ?, DATE_ADD(NOW(3), INTERVAL 24 DAY), '')",
        [`d30shot${Date.now()}`, seed.projectId],
      );
    },
  },
  {
    key: "checkin-ready",
    note: "A month on. One number and one line. Action needed.",
    setup: async () => {
      await phase("DELIVERED");
      await sql("UPDATE Project SET deliveredAt=DATE_SUB(NOW(3), INTERVAL 31 DAY), thanksSeenAt=NOW(3) WHERE id=?", [seed.projectId]);
      await sql(
        "INSERT INTO Day30 (id, projectId, unlocksAt, frictionNotes) VALUES (?, ?, DATE_SUB(NOW(3), INTERVAL 1 DAY), '')",
        [`d30shot${Date.now()}`, seed.projectId],
      );
    },
  },
  {
    key: "checkin-done",
    note: "The check-in is in. That is everything.",
    setup: async () => {
      await phase("DELIVERED");
      await sql("UPDATE Project SET deliveredAt=DATE_SUB(NOW(3), INTERVAL 34 DAY), thanksSeenAt=NOW(3) WHERE id=?", [seed.projectId]);
      await sql(
        "INSERT INTO Day30 (id, projectId, unlocksAt, frictionNotes, metricAfterValue, metricAfterSubmittedAt) VALUES (?, ?, DATE_SUB(NOW(3), INTERVAL 4 DAY), '', '18 a week', NOW(3))",
        [`d30shot${Date.now()}`, seed.projectId],
      );
    },
  },
];

/** The spare client borrows the seed's questionnaire, so the shots are real. */
async function copyIntakeToSpare(o: { sectionsDone: string; submitted: boolean }) {
  await sql("DELETE FROM Intake WHERE clientId=?", [spare.clientId]);
  await sql(
    `INSERT INTO Intake (id, clientId, document, documentUploadedAt, documentUploadedById, hiddenQuestionKeys, sectionsDone, answers, accessGranted, submittedAt)
     SELECT ?, ?, document, NOW(3), documentUploadedById, hiddenQuestionKeys, ?, '{}', '{}', ${o.submitted ? "NOW(3)" : "NULL"}
     FROM Intake WHERE clientId = ? LIMIT 1`,
    [`intshot${Date.now()}`, spare.clientId, o.sectionsDone, seed.clientId],
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  seed = await freshLink(SEED_SLUG);
  seedCookie = await session(seed.clientId);

  // Someone with a link and no project yet, for the four questionnaire states.
  const spareId = `spare${Date.now()}`;
  const spareToken = randomBytes(32).toString("base64url");
  await sql(
    `INSERT INTO Client (id, businessName, location, contactName, contactPhone, contactEmail, accessTokenHash, tokenCreatedAt, createdAt, updatedAt)
     VALUES (?, 'Meher Electricals', 'Pune', 'Meher Shah', '+91 90000 00000', 'spare@example.invalid', ?, NOW(3), NOW(3), NOW(3))`,
    [spareId, createHash("sha256").update(spareToken).digest("hex")],
  );
  spare = { clientId: spareId, token: spareToken, cookie: await session(spareId) };

  const browser = await chromium.launch();
  const contexts = new Map<string, BrowserContext>();
  for (const w of WIDTHS) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({
        viewport: { width: w.width, height: w.height },
        isMobile: w.mobile,
        hasTouch: w.mobile,
        deviceScaleFactor: 2,
        colorScheme: theme,
      });
      await ctx.addCookies([
        cookieFor(seedCookie),
        cookieFor(spare.cookie),
        { name: "awtm_theme", value: theme, domain: HOST, path: "/" },
      ]);
      contexts.set(`${w.name}:${theme}`, ctx);
    }
  }

  const taken: { key: string; note: string; files: Record<string, string> }[] = [];
  for (const shot of SHOTS) {
    if (ONLY && !ONLY.has(shot.key)) continue;
    await resetProject();
    await shot.setup();
    const token = shot.useSpare ? spare.token : seed.token;
    const files: Record<string, string> = {};
    for (const w of WIDTHS) {
      for (const theme of THEMES) {
        const page = await contexts.get(`${w.name}:${theme}`)!.newPage();
        await page.goto(`${BASE}/p/${token}`, { waitUntil: "networkidle" });
        await page.locator(".status").waitFor({ timeout: 15000 });
        // The dev server's own badge is not part of the page.
        await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], #__next-dev-overlay { display: none !important; }" });
        await page.waitForTimeout(350);
        const name = `${shot.key}--${w.name}--${theme}.png`;
        await page.screenshot({ path: `${OUT}/${name}`, fullPage: true });
        files[`${w.name}:${theme}`] = name;
        await page.close();
      }
    }
    taken.push({ key: shot.key, note: shot.note, files });
    console.log(`shot ${shot.key}`);
  }

  await browser.close();

  // Put everything back.
  await resetProject();
  await sql("DELETE FROM Intake WHERE clientId=?", [spare.clientId]);
  await sql("DELETE FROM ClientSession WHERE clientId IN (?, ?)", [spare.clientId, seed.clientId]);
  await sql("DELETE FROM Client WHERE id=?", [spare.clientId]);

  writeFileSync(`${OUT}/index.html`, sheet(taken));
  await closeDb();
  console.log(`\n${taken.length} states, ${taken.length * WIDTHS.length * THEMES.length} pictures`);
  console.log(`contact sheet: ${OUT}/index.html`);
}

function cookieFor(pair: string) {
  const [name, value] = pair.split("=");
  return { name, value, domain: HOST, path: "/" };
}

/** One page, every state, so a person can review it in one scroll. */
function sheet(taken: { key: string; note: string; files: Record<string, string> }[]): string {
  const rows = taken
    .map(
      (t) => `  <section>
    <h2>${t.key}</h2>
    <p>${t.note}</p>
    <div class="grid">
${WIDTHS.map((w) => THEMES.map((theme) => `      <figure><figcaption>${w.name} ${theme}</figcaption><a href="${t.files[`${w.name}:${theme}`]}"><img loading="lazy" src="${t.files[`${w.name}:${theme}`]}" alt="${t.key} at ${w.name} in ${theme}"></a></figure>`).join("\n")).join("\n")}
    </div>
  </section>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Client home, every state</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 28px; background: #141110; color: #ede7dc; font: 15px/1.6 ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 26px; margin: 0 0 6px; }
  .lede { color: #b0a496; max-width: 70ch; margin: 0 0 30px; }
  section { border-top: 1px solid #2e2925; padding: 22px 0 6px; }
  h2 { font-size: 17px; margin: 0 0 4px; font-family: ui-monospace, Menlo, monospace; color: #e08536; }
  section p { margin: 0 0 14px; color: #b0a496; }
  .grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
  figure { margin: 0; min-width: 0; }
  figcaption { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #b0a496; padding-bottom: 5px; }
  img { width: 100%; display: block; border: 1px solid #2e2925; border-radius: 2px; background: #1b1715; }
  @media (max-width: 1100px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style></head>
<body>
  <h1>The client home page, every state</h1>
  <p class="lede">Each state at 390, 768 and 1440, in dark and light. Made by scripts/ux-audit/client-home.ts, which drives the real database and puts it back afterwards. Click a picture for it at full size.</p>
${rows}
</body></html>`;
}

main().catch(async (e) => {
  console.error(String(e).slice(0, 400));
  await closeDb().catch(() => {});
  process.exit(1);
});
