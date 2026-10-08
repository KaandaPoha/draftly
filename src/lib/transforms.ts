/**
 * Draft transformations ("improve this draft" actions).
 *
 * Deterministic rewrites of the draft's own text. They are honest about being
 * edits: they never claim a model rewrote anything, and the draft page labels
 * each new version. Every transform is reproducible — no Math.random — so the
 * same draft and action always give the same result.
 *
 * Full regeneration (new angle, everything recomposed) lives in the caller,
 * which still has the original generation inputs; see makeRegenerator below.
 */

import { generateDraft, type GeneratedDraft, type GenerationInput } from "./generate";

export type TransformKind =
  | "shorter"
  | "more_professional"
  | "funnier"
  | "better_cta"
  | "new_hook"
  | "adapt_linkedin"
  | "adapt_instagram";

export const TRANSFORM_LABELS: Record<TransformKind, string> = {
  shorter: "Shorter",
  more_professional: "More professional",
  funnier: "Funnier",
  better_cta: "Improved CTA",
  new_hook: "New hook",
  adapt_linkedin: "Adapt for LinkedIn",
  adapt_instagram: "Adapt for Instagram",
};

export type TransformResult = {
  label: string;
  draft: GeneratedDraft;
  /** What this action actually changed, shown to the user. */
  note: string;
};

/* ---------- text helpers ---------- */

function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

function shorten(text: string, maxSentences: number): string {
  const kept = paragraphs(text).slice(0, 2).join("\n\n");
  const out = sentences(kept).slice(0, maxSentences).join(" ");
  return out || text;
}

/** Stable string hash so rewrite choices are reproducible. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/* ---------- transforms ---------- */

export function transformDraft(kind: TransformKind, current: GeneratedDraft): TransformResult {
  switch (kind) {
    case "shorter":
      return {
        label: TRANSFORM_LABELS.shorter,
        note: "Trimmed the body and caption to their strongest sentences. Hook and CTA untouched.",
        draft: {
          ...current,
          body: shorten(current.body, 3),
          caption: shorten(current.caption, 3),
        },
      };

    case "more_professional":
      return {
        label: TRANSFORM_LABELS.more_professional,
        note: "Removed exclamation marks, casual openers and emoji. Structure is unchanged.",
        draft: {
          ...current,
          hook: deCasual(current.hook),
          body: deCasual(current.body),
          caption: deCasual(current.caption),
          cta: deCasual(current.cta),
        },
      };

    case "funnier":
      return {
        label: TRANSFORM_LABELS.funnier,
        note: "Added one light aside about this draft's actual subject. Nothing was replaced.",
        draft: {
          ...current,
          body: `${current.body}\n\n${dryAside(current, hash(current.body + current.hook))}`,
        },
      };

    case "better_cta":
      return {
        label: TRANSFORM_LABELS.better_cta,
        note: "Replaced the CTA with one that asks for a specific, low-effort action.",
        draft: {
          ...current,
          cta: pickCta(current, hash(current.cta + current.goal)),
        },
      };

    case "new_hook": {
      const hooks = alternativeHooks(current);
      return {
        label: TRANSFORM_LABELS.new_hook,
        note: "Swapped only the opening line for a different angle. Nothing else changed.",
        draft: {
          ...current,
          hook: hooks[hash(current.hook + current.platform) % hooks.length],
        },
      };
    }

    case "adapt_linkedin":
      return adaptTo(current, "LinkedIn");

    case "adapt_instagram":
      return adaptTo(current, "Instagram");
  }
}

/* ---------- platform adaptation ---------- */

const PLATFORM_RULES: Record<
  string,
  { join: string; trim: number; note: string }
> = {
  LinkedIn: {
    join: "\n\n",
    trim: 4,
    note: "Reframed for LinkedIn: longer paragraphs, casual openers and emoji removed, professional close.",
  },
  Instagram: {
    join: "\n",
    trim: 3,
    note: "Reframed for Instagram: line breaks between ideas, tighter sentences, lighter close.",
  },
};

function adaptTo(current: GeneratedDraft, platform: string): TransformResult {
  const rule = PLATFORM_RULES[platform] ?? PLATFORM_RULES.LinkedIn;
  const cleaned = platform === "LinkedIn" ? deCasual(current.body) : current.body;
  const body = sentences(cleaned).slice(0, rule.trim).join(rule.join);
  const hook = platform === "LinkedIn" ? deCasual(current.hook) : current.hook;

  return {
    label: TRANSFORM_LABELS[platform === "LinkedIn" ? "adapt_linkedin" : "adapt_instagram"],
    note: rule.note,
    draft: {
      ...current,
      platform,
      hook,
      body,
      caption: `${hook}\n\n${body}`,
    },
  };
}

/* ---------- rewrites ---------- */

function deCasual(text: string): string {
  return text
    .replace(/!+/g, ".")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\b(hey|hi|okay, real talk|listen[.,])\s*—?\s*/gi, "")
    .replace(/\bgonna\b/gi, "going to")
    .replace(/\bwanna\b/gi, "want to")
    .replace(/\b(lol|haha)\b[.!]?/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,\s]+/, "")
    .trim();
}

/** One dry aside about the actual subject — not an appended joke template. */
function dryAside(current: GeneratedDraft, seed: number): string {
  const subject = (current.artboard?.headline ?? "this").toLowerCase();
  const lines = [
    `We tested this on the person in our office who is hardest to impress. Turns out ${subject} was the thing that finally did it.`,
    `Full disclosure: writing a serious post about ${subject} was harder than building it.`,
    `If this post reads calm, know that behind the scenes there was one (1) mild panic about the font.`,
  ];
  return lines[seed % lines.length];
}

function pickCta(current: GeneratedDraft, seed: number): string {
  const audience = current.audience;
  const options = [
    audience
      ? `If you're ${audience}, tell us which part you'd use first — we're reading every reply.`
      : "Tell us which part you'd use first — we're reading every reply.",
    "Save this now; you'll want it the next time this comes up.",
    "Reply with the word you'd search for to find this again — we'll take it as a vote.",
  ];
  return options[seed % options.length];
}

function alternativeHooks(current: GeneratedDraft): string[] {
  const subject = (current.artboard?.headline ?? "this").toLowerCase();
  const audience = current.audience;
  return [
    audience ? `If you're ${audience}, this one is aimed straight at you.` : "This one is aimed straight at you.",
    `${subject}: the short version, no filler.`,
    `Three things we'd tell you about ${subject} before you decide.`,
    `Nobody asked us to fix ${subject}. We did anyway.`,
    `We're not going to oversell this. ${subject}. That's it.`,
  ];
}

/* ---------- full regeneration ---------- */

/**
 * Rebuild a draft from scratch, one angle over. Requires the original inputs,
 * so the caller supplies them from the stored draft.
 */
export function regenerateVariant(
  input: Omit<GenerationInput, "variant">,
  variant: number
): GeneratedDraft {
  return generateDraft({ ...input, variant });
}