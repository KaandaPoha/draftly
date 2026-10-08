/**
 * Generation orchestrator.
 *
 * Real LLM when a provider is configured, Draftly's built-in generator
 * otherwise. The result always says which one produced it, and a failed LLM
 * call reports WHY it fell back — the UI shows that reason rather than
 * quietly pretending the output came from a model.
 */

import { generateDraft, type GeneratedDraft, type GenerationInput, type ImageGenerationInput } from "./generate";
import { complete, completeWithImage, extractJson, providerConfig, LlmError } from "./llm";
import { SYSTEM_PROMPT, buildUserPrompt, buildImageUserPrompt, coerceDraft } from "./prompt";

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
      maxTokens: 8000,
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

export type ImageGenerationResult = GenerationResult & {
  /** Input metadata echoed for the audit trail / status card. */
  imageMeta: { mimeType: string; bytes: number } | null;
};

/**
 * Image-based generation.
 *
 * IMPORTANT honesty rule: unlike text generation, there is NO silent fallback
 * here. If the model call fails, the error is returned to the UI (which shows
 * it and lets the user retry) rather than quietly producing a built-in draft
 * that never saw the image. A draft that never used the uploaded image must
 * never be labelled as if it did.
 */
export async function generateContentFromImage(input: {
  selections: ImageGenerationInput;
  imageDataUrl: string;
  imageMeta: { mimeType: string; bytes: number };
}): Promise<
  | { ok: true; draft: GeneratedDraft; model: string; imageMeta: { mimeType: string; bytes: number } }
  | { ok: false; error: string; canRetry: boolean }
> {
  const cfg = providerConfig();
  if (!cfg) {
    return {
      ok: false,
      error:
        "No AI provider is configured, so image understanding is unavailable. Add AI_API_KEY in Settings — Draftly will not pretend a built-in generator saw your image.",
      canRetry: false,
    };
  }

  try {
    const raw = await completeWithImage(
      SYSTEM_PROMPT,
      buildImageUserPrompt(input.selections),
      input.imageDataUrl,
      { maxTokens: 8000, json: true }
    );
    const parsed = extractJson<unknown>(raw);
    const fallback = generateDraft(input.selections);
    const draft = coerceDraft(parsed, input.selections, fallback);
    return {
      ok: true,
      draft,
      model: `${cfg.kind}:${cfg.model}`,
      imageMeta: input.imageMeta,
    };
  } catch (err) {
    const message =
      err instanceof LlmError
        ? err.friendly
        : "The AI provider call failed while reading your image. Please try again.";
    // Rate limits, truncation and network problems are retryable by design;
    // a missing provider key is not.
    const code = err instanceof LlmError ? err.code : null;
    return {
      ok: false,
      error: message,
      canRetry: code !== null && code !== "not_configured",
    };
  }
}