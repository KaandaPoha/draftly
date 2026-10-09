import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Reuse one PrismaClient across hot reloads in dev; single instance in prod.
 *
 * Vercel demo mode — serverless filesystems are READ-ONLY except /tmp, and
 * SQLite cannot open a database on a read-only path. When DATABASE_URL points
 * at a file: URL on Vercel, the bundled database (copied into the build by
 * next.config.ts via outputFileTracingIncludes, and exposed through
 * SQLITE_DEMO_DB_PATH) is copied into /tmp on first use in a warm instance,
 * and that copy is opened instead.
 *
 * Consequences, stated plainly so nobody is misled:
 *   - Every COLD START resets the database to the bundled snapshot.
 *   - Data lives only as long as the warm instance (minutes to hours).
 * This is a demo configuration only. For real deployments use hosted
 * Postgres: set provider "postgresql" in prisma/schema.prisma and point
 * DATABASE_URL at it. See README "Production deployment".
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Returns a DATABASE_URL usable on this runtime (files must live in /tmp). */
function resolveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("file:")) return url;

  // Local dev / self-hosted: the filesystem is writable, use the file as-is.
  // Vercel sets VERCEL="1" in every deployment; local runs never do.
  const onVercel = process.env.VERCEL === "1";
  if (!onVercel) return url;

  // Vercel demo: the filesystem is read-only except /tmp. Locate the bundled
  // snapshot — either an explicit path or the well-known trace-relative
  // location chosen by outputFileTracingIncludes in next.config.ts — and copy
  // it into /tmp on first use per warm instance.
  let bundledPath: string | undefined = process.env.SQLITE_DEMO_DB_PATH;
  if (!bundledPath) {
    // __dirname does not exist in ES module scope — derive it from the module URL.
    const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
    const candidates = [
      path.resolve(process.cwd(), "prisma/dev.db"),
      path.resolve(here, "../../prisma/dev.db"),
      path.resolve(here, "../../../../../prisma/dev.db"),
      path.resolve(here, "../../../../../../prisma/dev.db"),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        bundledPath = c;
        break;
      }
    }
  }
  if (!bundledPath) {
    // No bundled snapshot found — let Prisma fail loudly rather than pretend.
    return url;
  }

  try {
    const tmpDir = path.join("/tmp", "draftly-demo-db");
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpDb = path.join(tmpDir, "demo.db");
    // Copy once per warm instance; keep the existing copy otherwise so the
    // instance's data survives as long as it stays warm.
    if (!fs.existsSync(tmpDb)) fs.copyFileSync(bundledPath, tmpDb);
    return "file:" + tmpDb;
  } catch {
    // /tmp unusable — fall back and let the DB layer report the real error.
    return url;
  }
}

const resolved = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    resolved
      ? { datasources: { db: { url: resolved } } }
      : undefined
  );

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
