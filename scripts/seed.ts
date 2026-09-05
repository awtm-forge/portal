// Seeds the development database: the six library images, one client, one
// project with its questionnaire and a few answers. Prints the client link,
// which is fine only because this is a development database.
//   npm run db:seed
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import { hashToken, randomToken } from "../src/lib/crypto";
import { processUpload } from "../src/lib/files";
import { writeLibraryFile } from "../src/lib/storage";
import { validateDocument } from "../src/lib/intake/import";

const LIBRARY = [
  ["logo-wordmark", "Wordmark"], ["logo-monogram", "Monogram"], ["logo-emblem", "Emblem"],
  ["logo-mascot", "Mascot"], ["logo-abstract", "Abstract mark"], ["logo-combination", "Combination"],
] as const;

async function seedLibrary() {
  for (const [key, caption] of LIBRARY) {
    if (await db.imageLibrary.findUnique({ where: { key } })) continue;
    const buf = await readFile(path.join("image-library", "logo-directions", `${key}.png`));
    const r = await processUpload(buf);
    if (!r.ok) throw new Error(`${key}: ${r.reason}`);
    const storedPath = await writeLibraryFile(r.file.ext, r.file.data);
    await db.imageLibrary.create({ data: { key, caption, storedPath, mimeType: r.file.mime } });
    console.log(`library: ${key}`);
  }
}

async function seedProject() {
  const admin = await db.adminUser.findFirst({ orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("Create an admin first: npm run admin:create -- <email> <name>");
  if (await db.project.findUnique({ where: { slug: "kavya-appliances-store" } })) {
    console.log("project already seeded");
    return;
  }
  const raw = JSON.parse(await readFile(path.join("prisma", "seed", "intake-kavya-2026-08-18.json"), "utf8"));
  const keys = new Set((await db.imageLibrary.findMany({ select: { key: true } })).map((r) => r.key));
  const v = validateDocument(raw, keys);
  if (!v.ok) throw new Error("seed document fails import: " + JSON.stringify(v.failures, null, 2));

  const token = randomToken();
  const at = new Date("2026-08-20T10:05:11+05:30").toISOString();
  const project = await db.project.create({
    data: {
      name: "Store rebuild and checkout",
      slug: "kavya-appliances-store",
      typeOfWork: "STORE",
      accessTokenHash: hashToken(token),
      createdAt: new Date("2026-08-18T09:00:00+05:30"),
      client: {
        create: {
          businessName: "Kavya Appliances",
          contactName: "Kavya Menon",
          contactPhone: "+91 98450 12345",
          contactEmail: "kavya@kavyaappliances.example",
          signoffPersonName: "Kavya Menon",
          signoffPersonEmail: "kavya@kavyaappliances.example",
        },
      },
      intake: {
        create: {
          document: v.document,
          documentUploadedById: admin.id,
          documentUploadedAt: new Date("2026-08-18T09:30:00+05:30"),
          hiddenQuestionKeys: [],
          sectionsDone: ["business"],
          accessGranted: { acc_store: true, acc_dns: true },
          lastSavedAt: new Date("2026-09-02T21:14:00+05:30"),
          answers: {
            biz_what: { value: "Small kitchen appliances.", entered_by: "client", at },
            biz_where: { value: ["own_site", "amazon"], entered_by: "client", at },
            biz_volume: { value: "500_2k", entered_by: "team", at },
            biz_traffic: { value: "Meta ads, then Google. Some repeat by WhatsApp.", entered_by: "client", at },
            st_why: { value: "Cart says one delivery date, the payment page says another. Support gets it every day.", entered_by: "client", at },
            st_tried: { value: "Two theme changes and a plugin. The agency before said it was the courier.", entered_by: "client", at },
            st_platform: { value: "shopify", entered_by: "client", at },
            st_gateway: { value: ["razorpay", "phonepe"], entered_by: "client", at },
            st_abroad: { value: true, note: "", entered_by: "client", at },
            st_url: { value: "https://kavyaappliances.example", entered_by: "client", at },
            br_direction: { value: ["wordmark"], entered_by: "client", at },
            dec_signoff_name: { value: "Kavya Menon", entered_by: "client", at },
            dec_signoff_email: { value: "kavya@kavyaappliances.example", entered_by: "client", at },
          },
        },
      },
    },
  });
  console.log(`project ${project.slug} created`);
  console.log(`client link (dev only): ${(process.env.APP_URL ?? "http://localhost:3200")}/p/${token}`);
}

async function main() {
  await seedLibrary();
  await seedProject();
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
