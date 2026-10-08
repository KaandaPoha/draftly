/**
 * Draft translation and cross-platform adaptation.
 *
 * Uses the real LLM when configured (it is genuinely better at nuance),
 * falls back to the built-in dictionary mapping when not — and says which
 * one it used either way.
 */

import { complete, providerConfig, LlmError } from "./llm";
import type { GeneratedDraft } from "./generate";

export type TranslateTarget = { code: string; label: string };

export const LANGUAGES: TranslateTarget[] = [
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "ar", label: "Arabic" },
  { code: "ja", label: "Japanese" },
];

export type TranslatedDraft = {
  hook: string;
  caption: string;
  cta: string;
  /** Which engine produced it: the LLM or the fallback pass. */
  via: "llm" | "fallback";
};

function systemPrompt(target: string): string {
  return `You are a transcreation specialist for social media.

Translate the given social copy into ${target}. Transcreate, don't translate literally:
- Keep the energy, rhythm and intent, not word-for-word meaning.
- Keep proper nouns, product names and brand names unchanged.
- Keep emoji exactly where they are.
- Keep hashtags as-is unless the hashtag itself is common words, in which case translate it.
- Return ONLY valid JSON: {"hook": "...", "caption": "...", "cta": "..."}`;
}

function userPrompt(draft: GeneratedDraft, target: string): string {
  return `Translate this ${draft.platform} copy into ${target}:

HOOK:
${draft.hook}

CAPTION:
${draft.caption}

CTA:
${draft.cta}`;
}

export async function translateDraft(
  draft: GeneratedDraft,
  languageCode: string
): Promise<TranslatedDraft> {
  const target = LANGUAGES.find((l) => l.code === languageCode)?.label ?? languageCode;
  const cfg = providerConfig();

  if (cfg) {
    try {
      const raw = await complete(systemPrompt(target), userPrompt(draft, target), {
        maxTokens: 1500,
        json: true,
      });
      const parsed = JSON.parse(raw) as Partial<Record<"hook" | "caption" | "cta", string>>;
      if (parsed.hook && parsed.caption && parsed.cta) {
        return {
          hook: parsed.hook,
          caption: parsed.caption,
          cta: parsed.cta,
          via: "llm",
        };
      }
    } catch (err) {
      // Fall through to the fallback below; the caller reports which was used.
      if (!(err instanceof LlmError)) throw err;
    }
  }

  return {
    hook: fallbackTranslate(draft.hook, target),
    caption: fallbackTranslate(draft.caption, target),
    cta: fallbackTranslate(draft.cta, target),
    via: "fallback",
  };
}

/**
 * No-key fallback. This is NOT machine translation — it marks the language and
 * leaves the text intact for a human to translate. It never pretends to have
 * translated anything.
 */
function fallbackTranslate(text: string, target: string): string {
  return `[${target} — add your translation here]\n${text}`;
}