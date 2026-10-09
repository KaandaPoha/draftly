/**
 * Test-only resolver for tests/routes.test.ts (plain JS — this is loaded by
 * module.register, not by the TypeScript transform).
 *
 * It does exactly three things for modules imported afterwards:
 *   1. maps the bare "next/server" / "next/headers" specifiers the API routes
 *      use onto the real files (Next's package exports omit these subpaths);
 *   2. swaps two framework boundaries — "@/lib/auth" and "@/lib/prisma" — for
 *      the fakes in tests/helpers/;
 *   3. teaches Node the "@/..." alias the route files use.
 *
 * Everything else (route handlers, guards, visual renderers, prompt helpers)
 * resolves to production code. When nothing matches, the chain falls through
 * to nextResolve, which keeps tests/ts-resolve.mjs working.
 */
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx", ".js", ".json"];

// Next's package exports omit these subpaths, but the files exist on disk.
const NEXT_FILES = {
  "next/server": `${ROOT}/node_modules/next/server.js`,
  "next/headers": `${ROOT}/node_modules/next/headers.js`,
  // Server actions call redirect() from next/navigation; the CJS build throws
  // a digest-encoded error that tests can catch to learn the redirect URL.
  "next/navigation": `${ROOT}/node_modules/next/navigation.js`,
};

// Boundaries faked for tests. Everything else resolves to production code.
const BOUNDARIES = {
  "@/lib/auth": `${ROOT}/tests/helpers/stub-auth.ts`,
  "@/lib/prisma": `${ROOT}/tests/helpers/stub-prisma.ts`,
  "@/lib/rate-limit": `${ROOT}/tests/helpers/stub-rate-limit.ts`,
  "@/lib/submit-guard": `${ROOT}/src/lib/submit-guard.ts`,
  "@/lib/ai": `${ROOT}/tests/helpers/stub-ai.ts`,
};

export async function resolve(specifier, context, nextResolve) {
  if (NEXT_FILES[specifier]) {
    return { url: pathToFileURL(NEXT_FILES[specifier]).href, shortCircuit: true };
  }
  if (BOUNDARIES[specifier]) {
    return { url: pathToFileURL(BOUNDARIES[specifier]).href, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const base = resolvePath(ROOT, "src", specifier.slice(2));
    for (const suffix of SUFFIXES) {
      if (existsSync(base + suffix)) {
        return { url: pathToFileURL(base + suffix).href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}