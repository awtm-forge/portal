// Prints a fresh client link for a seed project, for looking at the client
// screens during development. Rotates the token, so the old link stops working.
//   npm run dev:link -- kavya-appliances-store
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { db } from "../src/lib/db";

async function main() {
  const slug = process.argv[2] ?? "kavya-appliances-store";
  const token = randomBytes(32).toString("base64url");
  const project = await db.project.findUniqueOrThrow({ where: { slug } });
  await db.client.update({
    where: { id: project.clientId },
    data: { accessTokenHash: createHash("sha256").update(token).digest("hex") },
  });
  await db.clientSession.deleteMany({ where: { clientId: project.clientId } });
  await db.rateLimit.deleteMany({});
  console.log(`${(process.env.APP_URL ?? "http://localhost:3200").replace(/\/$/, "")}/p/${token}`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
