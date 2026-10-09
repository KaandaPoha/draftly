/**
 * Content quality evaluation — heuristic, transparent, no black-box scores.
 *
 * Every dimension says why it scored that way, and each suggested fix maps to
 * an action already offered on the draft page, so nothing is decorative.
 * These are clearly-labelled heuristics, not predictions of engagement.
 */

/** Accepts the nullable shapes straight from the database. */
type DraftText = {
  hook: string | null;
  body: string | null;
  caption: string | null;
  cta: string | null;
  hashtags: string[] | string | null;
};

export type QualityDimension = {
  key: string;
  label: string;
  /** Coarse 0–3 scale. 3 = strongest. */
  score: 0 | 1 | 2 | 3;
  why: string;
  /** Only present when the score leaves room to improve. */
  fix?: string;
  /** The transform kind that applies the fix, where one exists. */
  action?: "shorter" | "more_professional" | "better_cta" | "new_hook";
};

export type QualityReport = {
  dimensions: QualityDimension[];
  /** Roughly how much of the platform's caption budget the copy uses. */
  lengthUse: string;
};

const words = (s: string | null | undefined) =>
  (s ?? "").trim().split(/\s+/).filter(Boolean).length;

/**
 * Stock AI phrases — if any of these survive into a draft, the copy reads as
 * machine-generated rather than written. The list mirrors the hard bans in
 * src/lib/prompt.ts so the evaluator catches what the prompt forbids.
 */
const GENERIC_PATTERNS: Array<[RegExp, string]> = [
  [/in today'?s (fast-?paced|modern|digital) world/i, "the classic AI opener “in today's … world”"],
  [/unlock(ing)? the power of/i, "“unlock the power of”"],
  [/game-?changer/i, "“game-changer”"],
  [/\bdive into\b/i, "“dive into”"],
  [/elevate (your|the)/i, "“elevate your/the …”"],
  [/take it to the next level/i, "“take it to the next level”"],
  [/it'?s not just .{3,60},? it'?s\b/i, "the “it's not just X, it's Y” construction"],
  [/in conclusion\b/i, "“in conclusion”"],
  [/revolutioni[sz]e/i, "“revolutionize”"],
  [/seamless(ly)? integrat/i, "“seamlessly integrate”"],
  [/cutting-?edge/i, "“cutting-edge”"],
  [/the (world|landscape) of\b/i, "“the world/landscape of …”"],
];

/** Emoji used as decoration rather than punctuation. */
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

const CAPTION_LIMITS: Record<string, number> = {
  X: 280,
  Facebook: 2000,
  Instagram: 2200,
  LinkedIn: 3000,
  YouTube: 5000,
};

export function evaluateDraft(
  draft: DraftText,
  ctx: {
    platform: string;
    goal: string;
    format: string;
    hasProfile: boolean;
    /** The audience text the user supplied, if any. */
    audience: string | null;
  }
): QualityReport {
  const dims: QualityDimension[] = [];

  const hook = (draft.hook ?? "").trim();
  const body = (draft.body ?? "").trim();
  const caption = (draft.caption ?? "").trim();
  const cta = (draft.cta ?? "").trim();
  const hookWords = words(hook);

  /* ---- hook clarity ---- */
  if (!hook) {
    dims.push({
      key: "hook",
      label: "Hook clarity",
      score: 0,
      why: "There is no opening hook, so the reader has no reason to stop scrolling.",
      fix: "Add one strong opening line before anything else.",
      action: "new_hook",
    });
  } else if (hookWords > (ctx.format === "reel" || ctx.format === "video_script" || ctx.format === "animation" ? 10 : 14)) {
    dims.push({
      key: "hook",
      label: "Hook clarity",
      score: 1,
      why: `The hook runs ${hookWords} words. First lines that survive a scroll are usually under ten.`,
      fix: "Lead with the shortest version of the claim, then explain underneath it.",
      action: "shorter",
    });
  } else if (hookWords <= 4) {
    dims.push({
      key: "hook",
      label: "Hook clarity",
      score: 2,
      why: "Very short hooks can be too vague to land — one concrete noun usually helps.",
      fix: "Try a version that names the thing itself.",
      action: "new_hook",
    });
  } else {
    dims.push({
      key: "hook",
      label: "Hook clarity",
      score: 3,
      why: `Short and direct at ${hookWords} words.`,
    });
  }

  /* ---- readability ---- */
  const prose = `${caption} ${body}`.trim();
  const sentences = prose.split(/[.!?]+/).filter((s) => words(s) > 0);
  const avg = sentences.length ? Math.round(words(prose) / sentences.length) : 0;
  if (avg > 22) {
    dims.push({
      key: "readability",
      label: "Readability",
      score: 1,
      why: `Sentences average ${avg} words, which reads as a block on a phone.`,
      fix: "Split the longest sentences — one idea each.",
      action: "shorter",
    });
  } else if (avg > 16) {
    dims.push({
      key: "readability",
      label: "Readability",
      score: 2,
      why: `Sentences average ${avg} words: easy to read, slightly dense for a feed.`,
      fix: "Split any sentence that carries two ideas.",
      action: "shorter",
    });
  } else {
    dims.push({
      key: "readability",
      label: "Readability",
      score: 3,
      why: `Short sentences, averaging ${avg} words. Scans well.`,
    });
  }

  /* ---- audience relevance ---- */
  // Judge against the audience the user actually typed. Matching a bare "for"
  // scored everything as strong, which made the dimension useless.
  const audienceTokens = (ctx.audience ?? "")
    .toLowerCase()
    .split(/[,;·]|\s+—\s+/)
    .flatMap((part) => part.split(/\s+/))
    .map((w) => w.replace(/[^\w+-]/g, ""))
    .filter((w) => w.length > 3 && !/^(\d+|and|the|with|from|that)$/.test(w));

  const audienceHits = audienceTokens.filter((t) => prose.toLowerCase().includes(t));
  const secondPerson = /\b(you|your|you're|yours)\b/i.test(prose);

  if (audienceHits.length > 0) {
    dims.push({
      key: "audience",
      label: "Audience relevance",
      score: 3,
      why: `The copy reflects the audience you described (${audienceHits.slice(0, 3).join(", ")}).`,
    });
  } else if (ctx.audience && secondPerson) {
    dims.push({
      key: "audience",
      label: "Audience relevance",
      score: 2,
      why: "It speaks to the reader directly, but never names what makes this audience specific.",
      fix: "Reference the audience directly — their situation, not a generic \"you\".",
    });
  } else if (ctx.audience) {
    dims.push({
      key: "audience",
      label: "Audience relevance",
      score: 1,
      why: `Nothing in the copy connects to the audience you described (${ctx.audience}).`,
      fix: "Open from their situation rather than from the product.",
    });
  } else {
    dims.push({
      key: "audience",
      label: "Audience relevance",
      score: 1,
      why: "No audience was specified, so this could be aimed at anyone.",
      fix: "Set an audience in the Create Studio so the copy can address them.",
    });
  }

  /* ---- platform suitability ---- */
  const cap = CAPTION_LIMITS[ctx.platform] ?? 2200;
  if (caption.length > cap) {
    dims.push({
      key: "platform",
      label: "Platform suitability",
      score: 0,
      why: `The caption is ${caption.length} characters, over ${ctx.platform}'s ${cap} limit — it will be cut off.`,
      fix: "Trim to the limit before posting.",
      action: "shorter",
    });
  } else if (ctx.platform === "X" && caption.length > 240) {
    dims.push({
      key: "platform",
      label: "Platform suitability",
      score: 1,
      why: `At ${caption.length} characters this leaves almost no room to be quoted on X.`,
      fix: "Tighten to under 240 characters.",
      action: "shorter",
    });
  } else {
    dims.push({
      key: "platform",
      label: "Platform suitability",
      score: 3,
      why: `Fits ${ctx.platform}'s ${cap}-character caption budget.`,
    });
  }

  /* ---- CTA clarity ---- */
  if (!cta) {
    dims.push({
      key: "cta",
      label: "CTA clarity",
      score: 0,
      why: "There is no call to action, so the reader finishes with no next step.",
      fix: "Ask for one specific action.",
      action: "better_cta",
    });
  } else {
    const asks = [
      /\bcomment/i, /\bsave/i, /\bshare/i, /\bclick/i, /\blink/i,
      /\bfollow/i, /\bshop/i, /\bsubscribe/i,
    ].filter((r) => r.test(cta)).length;
    dims.push(
      asks > 1
        ? {
            key: "cta",
            label: "CTA clarity",
            score: 1,
            why: `The CTA asks for ${asks} different actions. Split attention converts worse than one clear ask.`,
            fix: "Keep the single action that matches your goal.",
            action: "better_cta",
          }
        : {
            key: "cta",
            label: "CTA clarity",
            score: 3,
            why: "One clear action, with no competing asks.",
          }
    );
  }

  /* ---- specificity (generic-AI phrase scan) ---- */
  const genericHits = GENERIC_PATTERNS.filter(([re]) => re.test(prose)).map(([, label]) => label);
  if (genericHits.length > 0) {
    dims.push({
      key: "specificity",
      label: "Specificity",
      score: 1,
      why: `The copy leans on generic AI phrasing: ${genericHits.slice(0, 2).join(", ")}.`,
      fix: "Swap the stock phrases for something only this brand would say.",
      action: "shorter",
    });
  } else {
    dims.push({
      key: "specificity",
      label: "Specificity",
      score: 3,
      why: "No stock AI phrasing — the lines read like they were written, not generated.",
    });
  }

  /* ---- emoji restraint (feed platforms; LinkedIn is deliberately dry) ---- */
  if (ctx.platform !== "LinkedIn") {
    const emojiCount = (prose.match(EMOJI_RE) ?? []).length;
    const proseWords = Math.max(1, words(prose));
    if (emojiCount > 6 || (emojiCount >= 3 && proseWords < 60)) {
      dims.push({
        key: "emoji",
        label: "Emoji restraint",
        score: 1,
        why:
          emojiCount > 6
            ? `${emojiCount} emoji is more than a feed post needs — it reads as spam rather than style.`
            : "Emoji clusters in a short post pull the eye away from the words.",
        fix: "Keep at most one or two, in the hook or the CTA.",
      });
    }
  }

  /* ---- brand voice consistency ---- */
  dims.push(
    ctx.hasProfile
      ? {
          key: "voice",
          label: "Brand voice consistency",
          score: 3,
          why: "Written against your saved brand profile, so tone and preferred words carry through.",
        }
      : {
          key: "voice",
          label: "Brand voice consistency",
          score: 2,
          why: "No brand profile was selected, so this uses a neutral voice rather than yours.",
          fix: "Select a profile so the tone and preferred words follow yours.",
        }
  );

  return {
    dimensions: dims,
    lengthUse: `${caption.length} / ${cap} characters on ${ctx.platform}`,
  };
}