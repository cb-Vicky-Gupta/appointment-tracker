// Admin panel (Plan Phase A) — the *only* way an account becomes an admin.
// Deliberately not an API route: there is no HTTP path, authenticated or
// not, that can set `role: "ADMIN"` on a user. Run locally/against
// production with direct DB access, e.g.:
//
//   npm run grant-admin -- someone@example.com
//   npm run grant-admin -- someone@example.com --revoke   (back to USER)
//
// Running via tsx directly (not through `next dev`), so .env isn't loaded
// automatically the way Next.js loads it for the app itself — same reason
// prisma.config.ts needs this same import (see its top-of-file comment).
import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email) {
    console.error("Usage: npm run grant-admin -- <email> [--revoke]");
    process.exit(1);
  }

  const role = flag === "--revoke" ? "USER" : "ADMIN";

  const user = await prisma.user.update({
    where: { email },
    data: { role },
  });

  console.log(`${user.email} is now ${role}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
