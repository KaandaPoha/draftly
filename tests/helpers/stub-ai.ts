/**
 * Test-only fake for the AI boundary used by route and action guard tests.
 *
 * The real src/lib/ai.ts calls the configured provider (or the built-in
 * generator). The guard tests must not run generation at all in the cases
 * under test — they exist to prove what happens BEFORE any generation is
 * attempted — so the image path is replaced by a recording stub, while the
 * text path keeps its real implementation (the fallback generator runs
 * deterministically without a network call).
 *
 * Server actions and routes import "@/lib/ai"; the test resolver in
 * route-res.mjs redirects that specifier here.
 */
import { generateContent as realText } from "../../src/lib/ai.ts";

type Draft = {
  title: string;
  hook: string;
  body: string;
  caption: string;
  hashtags: string[];
  cta: string;
  visualDirection: string;
  storyboard: unknown;
  artboard: unknown;
  design: unknown;
};

let calls = 0;
let result: { ok: true; draft: Draft; model: string; imageMeta: { mimeType: string; bytes: number } } | { ok: false; error: string; canRetry: boolean } | null = null;

export function __setResult(next: NonNullable<typeof result>): void {
  result = next;
}

export function __calls(): number {
  return calls;
}

export function __reset(): void {
  calls = 0;
  result = null;
}

export async function generateContentFromImage(_input: unknown): Promise<NonNullable<typeof result>> {
  void _input; // the stub answers from configuration; the brief is ignored
  calls += 1;
  // With nothing configured, behave exactly like the real module's honesty
  // rule: fail loudly instead of pretending a generator saw the image.
  if (!result) {
    return {
      ok: false,
      error:
        "No AI provider is configured, so image understanding is unavailable. Add AI_API_KEY in Settings — Draftly will not pretend a built-in generator saw your image.",
      canRetry: false,
    };
  }
  return result;
}

/** Real text generation — the deterministic fallback needs no network. */
export const generateContent = realText;

/** Honesty rule from src/lib/ai.ts: without a key, image understanding must
 *  fail loudly rather than pretend a generator saw the picture. */
export function aiConfigured(): boolean {
  return false;
}
