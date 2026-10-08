/**
 * Deterministic draft transformations (regenerate actions).
 * Each returns a new version label + fields, derived from the current draft.
 * Demo-mode: rule-based rewriting of the existing copy, clearly labeled.
 */

import type { GeneratedDraft } from "./generate";

export type TransformKind =
  | "shorter"
  | "more_professional"
  | "funnier"
  | "better_cta"
  | "new_hook"
  | "regenerate";

export type TransformResult = {
  label: string;
  draft: GeneratedDraft;
};

function shortenText(text: string): string {
  // Keep first two paragraphs/sentences, trim the rest.
  const paras = text.split("\n\n").filter(Boolean);
  const kept = paras.slice(0, 2).join("\n\n");
  const sentences = kept.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, 3).join(" ");
}

export function transformDraft(
  kind: TransformKind,
  current: GeneratedDraft
): TransformResult {
  switch (kind) {
    case "shorter":
      return {
        label: "Shorter",
        draft: {
          ...current,
          body: shortenText(current.body),
          caption: shortenText(current.caption),
        },
      };

    case "more_professional":
      return {
        label: "More professional",
        draft: {
          ...current,
          hook: current.hook.replace(/stop scrolling if|hey|listen up —|okay, hear me out:/gi, "Introducing:"),
          body: current.body
            .replace(/!+/g, ".")
            .replace(/\bhears what's new\b/gi, "we're introducing")
            .replace(/Quick one —/g, "Announcing:"),
          cta: current.cta.replace(/👇/g, "").replace(/tell us/gi, "let us know"),
        },
      };

    case "funnier":
      return {
        label: "Funnier",
        draft: {
          ...current,
          hook:
            current.hook +
            " (Yes, we consulted our lawyer. He said no promises.)",
          body:
            current.body +
            "\n\nWarning: side effects may include telling your friends about this.",
        },
      };

    case "better_cta":
      return {
        label: "Improved CTA",
        draft: {
          ...current,
          cta:
            "Which one are you? Reply with a number — 1 if you'd try it today, 2 if you need more details first. 👇",
        },
      };

    case "new_hook": {
      const altHooks = [
        `Stop scrolling if ${current.audience ? `you're part of ${current.audience}` : "this sounds familiar"}.`,
        "Three things nobody tells you before trying this.",
        "We almost shipped this differently. Here's what changed.",
      ];
      return {
        label: "New hook",
        draft: { ...current, hook: altHooks[Math.floor(Math.random() * altHooks.length)] },
      };
    }

    case "regenerate":
    default:
      return { label: `Regenerated v${Math.floor(Math.random() * 900 + 100)}`, draft: current };
  }
}
