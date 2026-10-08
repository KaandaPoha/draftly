/**
 * AI provider adapter.
 *
 * If AI_API_KEY (and AI_PROVIDER) are set in the environment, real LLM
 * generation is attempted server-side. If not configured, or the call fails,
 * generation falls back to the deterministic demo generator — and the
 * response tells the UI which mode produced the draft so we never present
 * demo output as AI output.
 */

import { generateDraft, type GeneratedDraft, type GenerationInput } from "./generate";

export type GenerationResult = {
  draft: GeneratedDraft;
  mode: "ai" | "demo";
};

export function aiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY && process.env.AI_PROVIDER);
}

export async function generateWithAI(
  input: GenerationInput
): Promise<GenerationResult> {
  if (!aiConfigured()) return { draft: generateDraft(input), mode: "demo" };

  try {
    // Real provider calls land in Phase 6 (assistant) — the structured
    // prompt will be built from the same GenerationInput contract.
    // For now, any configured provider still falls back to demo output
    // rather than pretending AI generation happened.
    return { draft: generateDraft(input), mode: "demo" };
  } catch {
    return { draft: generateDraft(input), mode: "demo" };
  }
}
