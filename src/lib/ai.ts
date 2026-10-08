/**
 * Generation orchestrator.
 *
 * Real LLM when a provider is configured, Draftly's built-in generator
 * otherwise. The result always says which one produced it, and a failed LLM
 * call reports WHY it fell back — the UI shows that reason rather than
 * quietly pretending the output came from a model.
 */

import { generateDraft, type GeneratedDraft, type GenerationInput } from "./generate";
import { complete, extractJson, providerConfig, LlmError } from "./llm";
import { SYSTEM_PROMPT, buildUserPrompt, coerceDraft } from "./prompt";

export type GenerationResult = {
  draft: GeneratedDraft;
  mode: "llm" | "demo";
  /** Provider model used, when mode is "llm". */
  model: string | null;
  /** Why we fell back to the built-in generator, when mode is "demo". */
  notice: string | null;
};

export function aiConfigured(): boolean {
  return providerConfig() !== null;
}

export async function generateContent(input: GenerationInput): Promise<GenerationResult> {
  const fallback = () => generateDraft(input);
  const cfg = providerConfig();

  if (!cfg) {
    return {
      draft: fallback(),
      mode: "demo",
      model: null,
      notice: "Built-in generator — no AI provider is configured.",
    };
  }

  try {
    const raw = await complete(SYSTEM_PROMPT, buildUserPrompt(input), {
      maxTokens: 3000,
      json: true,
    });
    const parsed = extractJson<unknown>(raw);
    return {
      draft: coerceDraft(parsed, input, fallback()),
      mode: "llm",
      model: `${cfg.kind}:${cfg.model}`,
      notice: null,
    };
  } catch (err) {
    const notice =
      err instanceof LlmError
        ? err.friendly
        : "The AI provider call failed. Draftly used its built-in generator instead.";
    return { draft: fallback(), mode: "demo", model: null, notice };
  }
}