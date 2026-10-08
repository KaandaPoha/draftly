/**
 * Deterministic draft generation for demo mode.
 *
 * No LLM is configured, so drafts are assembled from templates that DO react
 * to the actual inputs: brand profile, audience, platform, goal, format.
 * Same inputs → same draft. Clearly labeled as demo output in the UI.
 *
 * When an AI provider key is configured (Phase 6+), a real LLM call will
 * produce richer drafts using the same structured output contract.
 */

export type GenerationInput = {
  idea: string;
  profile: {
    name: string;
    tone?: string | null;
    language?: string | null;
    wordsToUse?: string | null;
    wordsToAvoid?: string | null;
    audience?: string | null;
  } | null;
  audience?: string | null;
  platform: string;
  goal: string;
  format: string;
  variant: number; // 0, 1, 2… — picks alternative angles deterministically
};

export type GeneratedDraft = {
  title: string;
  hook: string;
  body: string;
  caption: string;
  hashtags: string[];
  cta: string;
  visualDirection: string;
  platform: string;
  goal: string;
  format: string;
  audience: string | null;
};

/* ---------- platform and format flavor ---------- */

const PLATFORM_FLAVOR: Record<string, { style: string; hashtags: string[]; length: string }> = {
  Instagram: {
    style: "punchy, emoji-light, line breaks between ideas",
    hashtags: ["#reels", "#instadaily", "#community"],
    length: "short and scannable",
  },
  LinkedIn: {
    style: "professional but human, story-led, no emoji spam",
    hashtags: ["#leadership", "#industryinsights", "#growth"],
    length: "substantive, 3 short paragraphs",
  },
  YouTube: {
    style: "scripted for spoken delivery, clear signposting",
    hashtags: ["#shorts", "#tutorial", "#howto"],
    length: "hook + 3 beats + close",
  },
  Facebook: {
    style: "conversational, community-focused",
    hashtags: ["#community", "#local", "#behindthescenes"],
    length: "medium, friendly",
  },
  X: {
    style: "one sharp idea per post, no filler",
    hashtags: [],
    length: "under 280 characters",
  },
};

const FORMAT_SHAPE: Record<string, unknown> = {};
void FORMAT_SHAPE;

/* ---------- helpers ---------- */

function toneWords(tone: string | null | undefined) {
  switch ((tone ?? "").toLowerCase()) {
    case "friendly & casual":
    case "friendly":
      return { open: "Hey", vibe: "easy-going" };
    case "bold & punchy":
      return { open: "Listen up —", vibe: "bold" };
    case "warm & storytelling":
      return { open: "Here's a quick story.", vibe: "warm" };
    case "witty & playful":
      return { open: "Okay, hear me out:", vibe: "playful" };
    case "professional & formal":
      return { open: "Today we're announcing", vibe: "professional" };
    default:
      return { open: "Quick one —", vibe: "clear" };
  }
}

function extractTopic(idea: string) {
  // First meaningful words of the idea, lowercased, trimmed to a phrase.
  const cleaned = idea.replace(/^(we are|we're|i am|i'm|announcing|launching|introducing)\s+/i, "");
  const words = cleaned.split(/\s+/).slice(0, 6).join(" ");
  return words.replace(/[.!?]+$/, "") || "your idea";
}

function brandWords(profile: GenerationInput["profile"]) {
  const toUse = (profile?.wordsToUse ?? "")
    .split(/[,;]/)
    .map((w) => w.trim())
    .filter(Boolean);
  return toUse;
}

/* ---------- hook angles: variant N picks angle N % 3 ---------- */

const HOOK_ANGLES = [
  (topic: string) => `Stop scrolling if you've ever struggled with ${topic}.`,
  (topic: string) => `Three things nobody tells you about ${topic}.`,
  (topic: string) => `We almost didn't ship ${topic}. Here's what changed our mind.`,
];

export function generateDraft(input: GenerationInput): GeneratedDraft {
  const flavor = PLATFORM_FLAVOR[input.platform] ?? PLATFORM_FLAVOR.Instagram;
  const topic = extractTopic(input.idea);
  const tone = toneWords(input.profile?.tone);
  const wordsToUse = brandWords(input.profile);
  const audience = input.audience || input.profile?.audience || null;
  const profileName = input.profile?.name ?? "your brand";

  // Alternative variants reshuffle structure deterministically.
  const v = Math.abs(input.variant) % 3;

  const hook = input.format === "hooks"
    ? [
        `${tone.open} ${topic} is not what you think.`,
        `What if ${topic} could do more?`,
        `${topic} — the part everyone gets wrong.`,
      ][v]
    : HOOK_ANGLES[v](topic);

  const bodyBase = {
    captions: `${tone.open} here's what's new: ${topic}.\n\nBuilt for ${audience ?? "you"} — and it shows in the details.\n\n${wordsToUse.length ? `If you care about ${wordsToUse.slice(0, 2).join(" and ")}, this one's for you.` : "More below."}`,
    hooks: hook,
    hashtags: `${(flavor.hashtags.concat(wordsToUse.map((w) => `#${w.replace(/\s+/g, "")}`))).slice(0, 8).join(" ")}`,
    video_script: `[HOOK — 0:00]\n${hook}\n\n[BEAT 1 — 0:03]\nIntroduce ${topic} and why it matters for ${audience ?? "the viewer"}.\n\n[BEAT 2 — 0:15]\nShow it in action. One concrete detail beats three vague claims.\n\n[CLOSE — 0:28]\n${tone.open} try it and tell us what you think.`,
    carousel: [
      `Slide 1 (hook): ${hook}`,
      `Slide 2: The problem — why ${topic} matters right now`,
      `Slide 3: The idea in one sentence`,
      `Slide 4: How it works, step by step`,
      `Slide 5: Proof or example`,
      `Slide 6: CTA — see caption`,
    ].join("\n"),
    image_concept: `A single strong visual for ${topic}: one subject, generous negative space, ${profileName} palette, minimal text overlay.`,
    headline: `${topic.charAt(0).toUpperCase() + topic.slice(1)}: made for ${audience ?? "you"}`,
    cta_only: `${tone.open} take the next step with ${topic}. ${v === 0 ? "Link below." : v === 1 ? "Tell us in the comments." : "Save this for later."}`,
    post: `${hook}\n\n${topic}, from ${profileName}. Written in a ${tone.vibe} tone for ${input.platform} — ${flavor.length}.`,
  } as Record<string, string>;

  const body = bodyBase[input.format] ?? bodyBase.post;

  const cta =
    input.goal === "engagement"
      ? `Which one are you? Tell us in the comments 👇`
      : input.goal === "leads"
      ? `Get the full guide — link in bio.`
      : input.goal === "sales"
      ? `Shop ${topic} now — link in bio.`
      : input.goal === "followers"
      ? `Follow ${profileName} for more on ${topic}.`
      : input.goal === "product launch"
      ? `${topic} is live — see what's new.`
      : input.goal === "education"
      ? `Save this so you don't forget it.`
      : `Learn more at the link.`;

  const hashtags = [
    ...new Set([
      ...flavor.hashtags,
      ...wordsToUse.map((w) => `#${w.replace(/\s+/g, "").toLowerCase()}`),
      `#${topic.split(/\s+/)[0]?.replace(/[^\w]/g, "").toLowerCase()}`,
    ]),
  ]
    .filter((h) => h.length > 2)
    .slice(0, 8);

  const title =
    input.format === "video_script"
      ? `Video script — ${topic}`
      : input.format === "carousel"
      ? `Carousel — ${topic}`
      : `${input.platform} ${input.format.replace("_", " ")} — ${topic}`;

  return {
    title,
    hook,
    body,
    caption: input.format === "captions" ? body : `${hook}\n\n${body.split("\n\n")[1] ?? topic}. ${cta}`,
    hashtags: input.format === "hashtags" ? body.split(/\s+/) : hashtags,
    cta,
    visualDirection:
      input.format === "image_concept"
        ? body
        : `${input.platform}-native visual: ${flavor.style}. Show ${topic} in real use — no stock-photo staging.`,
    platform: input.platform,
    goal: input.goal,
    format: input.format,
    audience,
  };
}
