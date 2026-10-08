/**
 * Heuristic style analysis of pasted sample posts.
 *
 * This is deliberately rule-based and transparent — NOT an AI/LLM model.
 * It measures observable characteristics of the text so users get useful,
 * honest signals before real AI analysis exists. Every result is shown to
 * the user labeled as inferred and editable.
 */

export type StyleAnalysis = {
  sampleCount: number;
  wordCountAvg: number;
  formality: "informal" | "neutral" | "formal";
  humor: "low" | "some" | "high";
  sentenceLength: "short" | "medium" | "long";
  emojiUsage: "none" | "light" | "frequent";
  vocabulary: "simple" | "moderate" | "rich";
  promotionalIntensity: "low" | "medium" | "high";
  storytelling: "low" | "moderate" | "strong";
  commonHooks: string[];
  ctaStyle: string;
};

const PROMO_WORDS = [
  "buy", "shop", "offer", "discount", "sale", "limited", "deal", "order",
  "price", "free", "grab", "promo", "checkout", "subscribe", "sign up",
];
const HUMOR_WORDS = [
  "lol", "haha", "funny", "joke", "hilarious", "😂", "🤣", "pun", "meme",
  "silly", "crazy", "wild",
];
const STORY_MARKERS = [
  "when i", "last year", "story", "remember", "one day", "back then",
  "started", "journey", "lesson", "learned", "that's why", "here's how",
];
const CTA_PATTERNS: Array<[RegExp, string]> = [
  [/link in bio/i, "Link in bio"],
  [/comment (below|) ?/i, "Comment prompt"],
  [/drop a|tell us|let us know/i, "Invitation to reply"],
  [/share (this|it) with/i, "Share prompt"],
  [/sign up|register|join/i, "Sign-up prompt"],
  [/shop|order|buy now/i, "Purchase prompt"],
  [/follow/i, "Follow prompt"],
  [/save (this|it)/i, "Save prompt"],
];

export function analyzeSamples(samples: string[]): StyleAnalysis {
  const texts = samples.map((s) => s.trim()).filter(Boolean);
  const all = texts.join("\n");
  const words = all.toLowerCase().match(/\b[\w']+\b/g) ?? [];
  const sentences = all.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);

  // Average words per sample:
  const perSample = texts.map((t) => (t.match(/\b[\w']+\b/g) ?? []).length);
  const avgWords = perSample.length
    ? Math.round(perSample.reduce((a, b) => a + b, 0) / perSample.length)
    : 0;

  const avgSentenceLen = sentences.length
    ? words.length / sentences.length
    : 0;
  const sentenceLength =
    avgSentenceLen < 9 ? "short" : avgSentenceLen < 20 ? "medium" : "long";

  const emojiCount = (all.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length;
  const emojiPerWord = words.length ? emojiCount / words.length : 0;
  const emojiUsage =
    emojiCount === 0 ? "none" : emojiPerWord < 0.02 ? "light" : "frequent";

  const contractions = (all.match(/\w+'(t|s|re|ve|ll|d)\b/gi) ?? []).length;
  const formalMarkers = (
    all.match(/\b(therefore|hereby|furthermore|pursuant|accordingly|regarding)\b/gi) ?? []
  ).length;
  const formality =
    formalMarkers > contractions ? "formal" : contractions > 2 ? "informal" : "neutral";

  const humorHits = HUMOR_WORDS.filter((w) =>
    all.toLowerCase().includes(w)
  ).length;
  const humor = humorHits >= 3 ? "high" : humorHits > 0 ? "some" : "low";

  const uniqueRatio = words.length ? new Set(words.map((w) => w.toLowerCase())).size / words.length : 0;
  const vocabulary =
    uniqueRatio > 0.65 ? "rich" : uniqueRatio > 0.45 ? "moderate" : "simple";

  const promoHits = PROMO_WORDS.filter((w) =>
    new RegExp(`\\b${w}\\b`, "i").test(all)
  ).length;
  const promotionalIntensity =
    promoHits >= 4 ? "high" : promoHits > 0 ? "medium" : "low";

  const storyHits = STORY_MARKERS.filter((m) => all.toLowerCase().includes(m)).length;
  const storytelling = storyHits >= 3 ? "strong" : storyHits > 0 ? "moderate" : "low";

  // Hooks: first sentence of each sample, trimmed, most representative ones
  const firstLines = texts
    .map((t) => t.split(/\n|\.\s|\?\s|!\s/)[0]?.trim())
    .filter((t): t is string => Boolean(t) && t.length > 12 && t.length < 120);
  const commonHooks = [...new Set(firstLines)].slice(0, 3);

  let ctaStyle = "No clear call to action detected";
  for (const [re, label] of CTA_PATTERNS) {
    if (re.test(all)) {
      ctaStyle = label;
      break;
    }
  }

  return {
    sampleCount: texts.length,
    wordCountAvg: avgWords,
    formality,
    humor,
    sentenceLength,
    emojiUsage,
    vocabulary,
    promotionalIntensity,
    storytelling,
    commonHooks,
    ctaStyle,
  };
}
