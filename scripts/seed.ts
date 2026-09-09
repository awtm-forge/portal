// Seeds a database.
//
// Two halves. The company row and the six library images are what any
// database needs, production included: the invoice prefix, the advance
// percentage and the logo directions the questionnaire refers to.
//
// The demo projects are development only. They carry fictional clients and
// they print a client link, which is a bearer credential (PORTAL-SPEC 5.9),
// so they are skipped when NODE_ENV is production unless --demo says
// otherwise. There is no delete-project path by design, so a demo project
// seeded into production would stay there.
//
//   npm run db:seed            company and library, plus demo outside production
//   npm run db:seed -- --demo  demo projects as well, wherever you are
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import { hashToken, randomToken } from "../src/lib/crypto";
import { processUpload } from "../src/lib/files";
import { writeLibraryFile } from "../src/lib/storage";
import { validateDocument } from "../src/modules/intake/import";
import { agree } from "../src/modules/agreements";
import { COMPANY_ID } from "../src/modules/settings";

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
      signoffPersonName: "Kavya Menon",
      signoffPersonEmail: "kavya@kavyaappliances.example",
      createdAt: new Date("2026-08-18T09:00:00+05:30"),
      client: {
        create: {
          businessName: "Kavya Appliances",
          contactName: "Kavya Menon",
          contactPhone: "+91 98450 12345",
          contactEmail: "kavya@kavyaappliances.example",
          location: "Bengaluru",
          accessTokenHash: hashToken(token),
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
    },
    },
  });
  console.log(`project ${project.slug} created`);
  console.log(`client link (dev only): ${(process.env.APP_URL ?? "http://localhost:3200")}/p/${token}`);
}

/** CLAUDE.md section 5: one company row, never a real client's details. */
async function seedCompany() {
  await db.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: {
      id: COMPANY_ID,
      name: "awtm forge",
      address: "Bengaluru, Karnataka, India",
      email: "hello@awtmforge.com",
      phone: "",
      invoicePrefix: "AWTM",
      gstin: null,
      bookingUrl: null,
      defaultAdvancePct: 50,
    },
  });
  console.log("company: awtm forge");
}

/**
 * PORTAL-SPEC section 9 step 2: one realistic project in building, with a
 * submitted intake, an agreed agreement and a paid advance invoice. The client
 * is fictional.
 */
async function seedBuildingProject() {
  const admin = await db.adminUser.findFirst({ orderBy: { createdAt: "asc" } });
  if (!admin) return;
  if (await db.project.findUnique({ where: { slug: "sundara-living-storefront" } })) {
    console.log("building project already seeded");
    return;
  }
  const raw = JSON.parse(await readFile(path.join("prisma", "seed", "intake-kavya-2026-08-18.json"), "utf8"));
  const keys = new Set((await db.imageLibrary.findMany({ select: { key: true } })).map((r) => r.key));
  const v = validateDocument(raw, keys);
  if (!v.ok) throw new Error("seed document fails import");

  const token = randomToken();
  const at = new Date("2026-08-12T11:00:00+05:30").toISOString();
  const project = await db.project.create({
    data: {
      name: "Storefront and returns flow",
      slug: "sundara-living-storefront",
      typeOfWork: "STORE",
      signoffPersonName: "Arjun Sundaram",
      signoffPersonEmail: "arjun@sundaraliving.example",
      createdAt: new Date("2026-08-05T09:00:00+05:30"),
      phase: "AGREEMENT_SENT",
      weekCount: 8,
      metricName: "Returns raised per hundred orders",
      metricBaselineValue: "11",
      metricBaselineCapturedAt: new Date("2026-08-12T11:00:00+05:30"),
      afterDelivery: "RETAINER",
      retainerTier: "Monthly, one working session a week",
      retainerNamedPerson: "Rahul",
      retainerResponseTime: "One working day",
      client: {
        create: {
          businessName: "Sundara Living",
          contactName: "Arjun Sundaram",
          contactPhone: "+91 98860 44120",
          contactEmail: "arjun@sundaraliving.example",
          location: "Chennai",
          accessTokenHash: hashToken(token),
          linkEmailedAt: new Date("2026-08-05T09:05:00+05:30"),
          intake: {
            create: {
          document: v.document,
          documentUploadedById: admin.id,
          documentUploadedAt: new Date("2026-08-05T09:30:00+05:30"),
          hiddenQuestionKeys: [],
          sectionsDone: v.document.sections.map((s) => s.key),
          accessGranted: { acc_store: true, acc_dns: true, acc_courier: true },
          submittedAt: new Date("2026-08-12T11:20:00+05:30"),
          lastSavedAt: new Date("2026-08-12T11:20:00+05:30"),
          answers: {
            biz_what: { value: "Home textiles and small furniture.", entered_by: "client", at },
            st_why: { value: "Returns are eating the margin and nobody can tell me why.", entered_by: "client", at },
            st_tried: { value: "Changed the size guide. It did not move.", entered_by: "client", at },
            st_tuesday: { value: "I would stop reading the returns inbox at eleven at night.", entered_by: "client", at },
            st_platform: { value: "woo", entered_by: "client", at },
            dec_signoff_name: { value: "Arjun Sundaram", entered_by: "client", at },
            dec_signoff_email: { value: "arjun@sundaraliving.example", entered_by: "client", at },
          },
        },
      },
        },
      },
      agreement: {
        create: {
          scope: "Rebuild the storefront and the returns flow for Sundara Living, so a customer can see why a return happens before they buy, and raise one without an email.",
          deliverables: [
            { key: "d1", text: "A storefront on the new template, with the size and material detail on the product page", how_to_check: "Open three product pages on your phone and find the measurements without scrolling twice." },
            { key: "d2", text: "A self-service returns flow, from the order page to a printed label", how_to_check: "Raise a return on a real order and get the label without messaging anyone." },
            { key: "d3", text: "The returns reasons recorded and visible in one weekly figure", how_to_check: "Open the dashboard on a Monday and read the top three reasons." },
          ],
          notIncluded: "Product photography, the courier contract itself, and anything to do with your GST filing.",
          startDate: new Date("2026-08-17T12:00:00Z"),
          launchTargetDate: new Date("2026-10-12T12:00:00Z"),
          milestones: [{ label: "Something you can open", date: "2026-08-28" }],
          totalPaise: 52000000n,
          advancePct: 50,
          howWeWork: "A short written update every week, whether or not anything went wrong. A call every two weeks that either of us can book. You can open the work on a real link whenever you want.",
          ifWeMiss: "If a date is going to slip, we tell you in the weekly update before it slips, with the new date and the reason.",
          afterDeliveryOffer: "A monthly retainer: one working session a week, a named person, and a reply within one working day.",
          internalCostPaise: 21000000n,
          internalNotes: "Two developers for six weeks, plus a week of design. Courier integration is the risk.",
          sentAt: new Date("2026-08-14T10:00:00+05:30"),
          version: 1,
        },
      },
    },
  });

  // Sign it off through the real path, so the invoice and the sign-off event
  // are made the way production makes them.
  const signed = await agree({
    projectId: project.id,
    actorName: "Arjun Sundaram",
    method: "PORTAL",
    ip: "127.0.0.1",
    userAgent: "seed",
    at: new Date("2026-08-15T09:12:00+05:30"),
  });
  if (!signed.ok) throw new Error(`seed sign-off failed: ${signed.reason}`);

  await db.invoice.updateMany({
    where: { projectId: project.id, kind: "ADVANCE" },
    data: { status: "PAID", paidAt: new Date("2026-08-18T10:00:00+05:30"), paidReference: "NEFT seed", paymentMethod: "Bank transfer" },
  });
  await db.project.update({ where: { id: project.id }, data: { phase: "BUILDING" } });

  console.log(`project ${project.slug} created, advance ${signed.invoiceNumber} marked paid`);
  console.log(`client link (dev only): ${(process.env.APP_URL ?? "http://localhost:3200")}/p/${token}`);
}

async function main() {
  const demo = process.argv.includes("--demo") || process.env.NODE_ENV !== "production";

  await seedCompany();
  await seedLibrary();

  if (demo) {
    await seedProject();
    await seedBuildingProject();
  } else {
    console.log("demo projects skipped: NODE_ENV is production. Pass --demo to seed them anyway.");
  }
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
