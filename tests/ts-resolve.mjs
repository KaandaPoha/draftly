/**
 * Test-only ESM resolve hook.
 *
 * The application source uses extensionless relative imports ("./generate"),
 * which Next's bundler and TypeScript resolve but plain Node ESM does not.
 * Rather than change production imports to satisfy the test runner, this hook
 * teaches the test process the same resolution rule.
 *
 * It is intentionally minimal: it only appends a TypeScript extension to a
 * relative specifier that does not already resolve.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CANDIDATE_SUFFIXES = [".ts", ".tsx", ".mts", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      // Only fall through for genuinely unresolvable relative specifiers.
      if (err?.code !== "ERR_MODULE_NOT_FOUND") throw err;

      for (const suffix of CANDIDATE_SUFFIXES) {
        try {
          return await nextResolve(specifier + suffix, context);
        } catch {
          // try the next candidate
        }
      }

      // Nothing matched: re-throw the original error so failures stay legible.
      throw err;
    }
  }

  return nextResolve(specifier, context);
}

/** Kept for the unused-import guard in some tooling; not needed at runtime. */
export const _existsSync = existsSync;
export const _fileURLToPath = fileURLToPath;