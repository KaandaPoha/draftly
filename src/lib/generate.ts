/**
 * Draft generation contract + Draftly's built-in generator.
 *
 * Two producers satisfy this contract:
 *   1. The real LLM path (lib/ai.ts → lib/prompt.ts → lib/llm.ts)
 *   2. The built-in generator below, used when no provider key is configured
 *
 * Both emit the SAME structure — copy plus a storyboard, an artboard spec,
 * and a design spec — so the UI never has to care which one produced a draft.
 * Every draft records which producer made it, and the UI labels it.
 */

/* ---------- structured output contract ---------- */

export type StoryboardShot = {
  index: number; // 1-based
  timecode: string; // e.g. "0:00–0:03"
  shot: string; // camera framing / direction
  onScreen: string; // text overlay
  voiceover: string; // spoken line
  transition: string; // cut | match cut | whip pan | ...
};

export type ArtboardSpec = {
  headline: string;
  subhead: string;
  cta: string;
  palette: {
    bg: string;
    surface: string;
    fg: string;
    accent: string;
    accent2: string;
  };
  layout: "split" | "centered" | "stacked";
  motif: "circles" | "grid" | "waves" | "burst";
  aspect: "square" | "portrait" | "landscape";
  artDirection: string;
};

export type DesignSpec = {
  palette: string[];
  typography: string;
  layout: string;
  motion: string;
};

export type GenerationInput = {
  idea: string;
  profile: {
    name: string;
    tone?: string | null;
    language?: string | null;
    wordsToUse?: string | null;
    wordsToAvoid?: string | null;
    audience?: string | null;
    niche?: string | null;
    offerings?: string | null;
    colors?: string | null;
    guidelines?: string | null;
    description?: string | null;
    styleAnalysis?: string | null;
  } | null;
  audience?: string | null;
  platform: string;
  goal: string;
  format: string;
  variant: number;
};

/** Input for image-based generation: a GenerationInput plus the extra
 *  selections that only apply when an image is attached. `idea` is derived
 *  from the user's instructions so the deterministic fallback still works. */
export type ImageGenerationInput = GenerationInput & {
  tone: string;
  language: string;
  instructions: string;
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
  storyboard: StoryboardShot[];
  artboard: ArtboardSpec;
  design: DesignSpec;
};

/** Formats that produce a shot-by-shot storyboard rather than still art. */
export const MOVING_FORMATS = new Set(["video_script", "reel", "animation"]);

export function isMovingFormat(format: string): boolean {
  return MOVING_FORMATS.has(format);
}

/* ---------- deterministic helpers ---------- */

/** Stable 32-bit hash, so the same input always yields the same output. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** Turn a raw idea into a clean topic phrase for headlines. */
export function extractTopic(idea: string): string {
  const cleaned = idea
    .replace(/^(we are|we're|i am|i'm|we|i)\s+(are\s+)?(announcing|launching|introducing|presenting|releasing|dropping)\s+/i, "")
    .replace(/^(announcing|launching|introducing|presenting|releasing|dropping)\s+/i, "")
    .replace(/^(our|my|the)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").slice(0, 9).join(" ");
  return words.replace(/[.!?,;:]+$/, "").trim() || "your idea";
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- brand voice ---------- */

type Voice = {
  /** how the copy opens */
  open: string;
  /** adjective describing the vibe, used inside copy */
  vibe: string;
  /** sentence rhythm */
  rhythm: "clipped" | "flowing" | "measured";
  /** emoji appetite 0–2 */
  emoji: number;
};

const VOICES: Record<string, Voice> = {
  "friendly & casual": { open: "Okay, real talk.", vibe: "easy-going", rhythm: "flowing", emoji: 1 },
  friendly: { open: "Okay, real talk.", vibe: "easy-going", rhythm: "flowing", emoji: 1 },
  casual: { open: "Okay, real talk.", vibe: "easy-going", rhythm: "flowing", emoji: 1 },
  "bold & punchy": { open: "Listen.", vibe: "bold", rhythm: "clipped", emoji: 0 },
  bold: { open: "Listen.", vibe: "bold", rhythm: "clipped", emoji: 0 },
  "warm & storytelling": { open: "There's a story here.", vibe: "warm", rhythm: "flowing", emoji: 0 },
  storytelling: { open: "There's a story here.", vibe: "warm", rhythm: "flowing", emoji: 0 },
  "witty & playful": { open: "Hear me out.", vibe: "playful", rhythm: "clipped", emoji: 2 },
  playful: { open: "Hear me out.", vibe: "playful", rhythm: "clipped", emoji: 2 },
  "professional & formal": { open: "A quick update.", vibe: "measured", rhythm: "measured", emoji: 0 },
  professional: { open: "A quick update.", vibe: "measured", rhythm: "measured", emoji: 0 },
  formal: { open: "A quick update.", vibe: "measured", rhythm: "measured", emoji: 0 },
};

/** Derive voice from the profile tone, falling back to the style analysis. */
function voiceFor(profile: GenerationInput["profile"]): Voice {
  const tone = (profile?.tone ?? "").toLowerCase().trim();
  if (tone && VOICES[tone]) return VOICES[tone];

  // Match on a substring, so "Friendly, a bit cheeky" still finds a voice.
  for (const [key, voice] of Object.entries(VOICES)) {
    if (tone.includes(key)) return voice;
  }

  // Fall back to the inferred style analysis when the profile has no tone.
  if (profile?.styleAnalysis) {
    try {
      const a = JSON.parse(profile.styleAnalysis) as {
        formality?: string;
        humor?: string;
        emojiUsage?: string;
        overrides?: Record<string, string>;
      };
      const merged = { ...a, ...(a.overrides ?? {}) };
      if (merged.formality === "informal") return VOICES["friendly"];
      if (merged.formality === "formal") return VOICES["professional"];
      if (merged.humor === "high") return VOICES["witty & playful"];
    } catch {
      // ignore a malformed analysis blob
    }
  }

  return { open: "Quick one —", vibe: "clear", rhythm: "flowing", emoji: 0 };
}

function brandWords(profile: GenerationInput["profile"]): string[] {
  return (profile?.wordsToUse ?? "")
    .split(/[,;]/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function avoidWords(profile: GenerationInput["profile"]): string[] {
  return (profile?.wordsToAvoid ?? "")
    .split(/[,;]/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

/* ---------- palette ---------- */

const PALETTES: ArtboardSpec["palette"][] = [
  { bg: "#0f0b1e", surface: "#1a1430", fg: "#f4f2ff", accent: "#8b5cf6", accent2: "#22d3ee" },
  { bg: "#0a1628", surface: "#122336", fg: "#eef6ff", accent: "#3b82f6", accent2: "#f59e0b" },
  { bg: "#1a0f14", surface: "#2a1a20", fg: "#fff1f2", accent: "#f43f5e", accent2: "#fb923c" },
  { bg: "#0b1a12", surface: "#12291d", fg: "#ecfdf5", accent: "#10b981", accent2: "#a3e635" },
  { bg: "#1c1917", surface: "#292524", fg: "#fafaf9", accent: "#f97316", accent2: "#facc15" },
  { bg: "#120e24", surface: "#1e1836", fg: "#f5f3ff", accent: "#a855f7", accent2: "#ec4899" },
];

const HEX = /#([0-9a-f]{3}|[0-9a-f]{6})\b/gi;

/** Use the profile's own colours when it has them — brand consistency. */
function paletteFor(profile: GenerationInput["profile"], seed: number): ArtboardSpec["palette"] {
  const found = (profile?.colors ?? "").match(HEX);
  if (found && found.length >= 2) {
    return {
      bg: "#0d0b16",
      surface: "#171327",
      fg: "#f6f5ff",
      accent: found[0],
      accent2: found[1],
    };
  }
  return pick(PALETTES, seed);
}

/* ---------- platform + goal flavour ---------- */

const PLATFORM: Record<
  string,
  { rhythm: string; hashtags: string[]; maxCaption: number; visual: string; motion: string }
> = {
  Instagram: {
    rhythm: "short lines, one idea per line",
    hashtags: ["#reels", "#instadaily", "#creators"],
    maxCaption: 2200,
    visual: "bold type over a single hero subject, heavy negative space",
    motion: "fast opening cut, 0.5s beat sync, seamless loop",
  },
  LinkedIn: {
    rhythm: "three short paragraphs, no hashtag spam",
    hashtags: ["#growth", "#professionaldevelopment", "#industryinsights"],
    maxCaption: 3000,
    visual: "clean editorial layout, one data point, generous margins",
    motion: "slow vertical pan, one text card per beat",
  },
  YouTube: {
    rhythm: "written for the ear, clear signposting",
    hashtags: ["#shorts", "#tutorial", "#howto"],
    maxCaption: 5000,
    visual: "high-contrast thumbnail face + 4-word title",
    motion: "hook in first 2s, pattern interrupt every 4s",
  },
  Facebook: {
    rhythm: "conversational, community-first",
    hashtags: ["#community", "#behindthescenes"],
    maxCaption: 2000,
    visual: "warm candid photo, minimal overlay",
    motion: "gentle push-in, captions burned in",
  },
  X: {
    rhythm: "one sharp idea, no filler",
    hashtags: [],
    maxCaption: 280,
    visual: "text-only or one clean chart, no decoration",
    motion: "static image; thread carries the momentum",
  },
};

const GOAL_CTA: Record<string, string[]> = {
  awareness: [
    "If this is news to you, you're not alone — here's what's changing.",
    "Save this. It'll make sense the next time it comes up.",
  ],
  engagement: [
    "Which side are you on? Tell us below.",
    "Drop a 🙋 if this is you — we read every reply.",
  ],
  followers: [
    "We post one of these every week — follow along.",
    "More where this came from. Follow to catch the next one.",
  ],
  education: [
    "Save this for the next time you need it.",
    "Bookmark it — you'll want it later.",
  ],
  leads: [
    "Want the full breakdown? It's linked in bio.",
    "Full guide in our bio — no email gate.",
  ],
  sales: [
    "It's live now — link in bio.",
    "Grab yours before this batch goes.",
  ],
  "product launch": [
    "It's live today. Go take a look.",
    "Available now — link in bio.",
  ],
};

/* ---------- hook angles ---------- */

const HOOK_ANGLES: Array<
  (idea: ParsedIdea, aud: ParsedAudience | null, brand: string) => string
> = [
  (i, a) => {
    if (i.benefit)
      return /^to\s/i.test(i.benefit)
        ? `${titleCase(i.subject)} — made to ${i.benefit.replace(/^to\s+/i, "")}.`
        : `${titleCase(i.subject)} — it ${i.benefit.replace(/[.!?]+$/, "")}.`;
    const who = a?.label ?? null;
    if (who) return `Built for ${who} — this one's for you.`;
    return `Most people get ${i.subject} wrong. Here's the version that works.`;
  },
  (i, a) => {
    const who = a?.label ?? null;
    return who
      ? `${titleCase(i.subject)}, built for ${who}.`
      : `${titleCase(i.subject)} — but not the way you've seen it done.`;
  },
  (i) => {
    const c = i.category;
    if (!c) return `We spent months on ${i.subject}. Here's what actually mattered.`;
    return i.benefit
      ? `We built a ${c} that ${i.benefit.replace(/^to\s+/i, "")}.`
      : `We built a ${c} that actually does what it says.`;
  },
  (i) => `${titleCase(i.subject)}. In one line: ${i.benefit ? i.benefit.replace(/^to\s+/i, "") : "it's simpler than you think"}.`,
  (i, a) => {
    if (a?.interests.length)
      return `If ${a.interests[0]} is your week, ${titleCase(i.subject)} was built for it.`;
    if (a?.age)
      return `Most things in this category ignore ${a.ageWord}. ${titleCase(i.subject)} starts there.`;
    return `The version of ${i.subject} you've seen is the noise, not the signal.`;
  },
  (i, _a, b) => `What ${b} learned building ${i.subject} — the short version.`,
];

/* ---------- built-in generator ---------- */

export function generateDraft(input: GenerationInput): GeneratedDraft {
  const topic = extractTopic(input.idea);
  const voice = voiceFor(input.profile);
  const platform = PLATFORM[input.platform] ?? PLATFORM.Instagram;
  const audience = input.audience || input.profile?.audience || null;
  const brand = input.profile?.name ?? "your brand";
  const toUse = brandWords(input.profile);
  const avoid = avoidWords(input.profile);
  const goalKey = input.goal.toLowerCase();
  const seed = hash(`${input.idea}|${input.platform}|${input.goal}|${input.format}|${input.variant}`);
  const v = Math.abs(input.variant) % HOOK_ANGLES.length;

  const idea = parseIdea(input.idea);
  const aud = parseAudience(audience);

  const hook = HOOK_ANGLES[v](idea, aud, brand);

  /* --- body, shaped per format --- */
  const bodyByFormat: Record<string, string> = {
    captions: composeCaption({ idea, aud, voice, toUse, platform }),
    hooks: [
      hook,
      "",
      HOOK_ANGLES[(v + 1) % HOOK_ANGLES.length](idea, aud, brand),
      "",
      HOOK_ANGLES[(v + 2) % HOOK_ANGLES.length](idea, aud, brand),
    ].join("\n"),
    hashtags: buildHashtags(topic, brand, toUse, platform).join(" "),
    video_script: "", // filled from the storyboard below
    carousel: "", // filled from the storyboard below
    image_concept: "",
    headline: `${titleCase(idea.subject)} — ${aud?.label ? `made for ${aud.label}` : "made to be understood"}`,
    cta_only: pick(GOAL_CTA[goalKey] ?? GOAL_CTA.awareness, seed),
    post: composePost({ idea, aud, voice, brand, platform: input.platform }),
    reel: "",
    animation: "",
  };

  /* --- storyboard: every format gets one, moving formats drive the body --- */
  const cta = pick(GOAL_CTA[goalKey] ?? GOAL_CTA.awareness, seed);

  const storyboard = buildStoryboard({
    idea,
    aud,
    hook,
    brand,
    format: input.format,
    cta,
  });

  if (isMovingFormat(input.format)) {
    bodyByFormat[input.format] = storyboardToScript(storyboard);
  } else if (input.format === "carousel") {
    bodyByFormat.carousel = storyboardToCarousel(storyboard);
  } else if (input.format === "image_concept") {
    bodyByFormat.image_concept = buildVisualDirection(idea.subject, brand, platform.visual);
  }

  const body = bodyByFormat[input.format] ?? bodyByFormat.post;

  const hashtags = buildHashtags(topic, brand, toUse, platform);

  const artboard = buildArtboard({
    idea, aud, hook, cta, brand, seed, profile: input.profile,
    platform: input.platform, variant: v,
  });

  const design: DesignSpec = {
    palette: [artboard.palette.accent, artboard.palette.accent2, artboard.palette.bg],
    typography:
      voice.rhythm === "clipped"
        ? "Heavy display type, tight tracking, all-caps accents"
        : voice.rhythm === "measured"
        ? "Serif or high-contrast sans for the headline, generous leading"
        : "Geometric sans, sentence case, comfortable 1.6 line-height",
    layout: platform.visual,
    motion: platform.motion,
  };

  const SCRIPT_FORMATS = new Set([...MOVING_FORMATS, "carousel"]);
  const captionBody =
    input.format === "captions"
      ? body
      : input.format === "hashtags"
      ? hashtags.join(" ")
      : SCRIPT_FORMATS.has(input.format)
      ? composeCaption({ idea, aud, voice, toUse, platform })
      : body;

  // Keep the caption inside the platform's limit (X is 280).
  const caption =
    input.format === "image_concept"
      ? trimTo(cta, platform.maxCaption)
      : trimTo(`${captionBody.trim()}\n\n${cta}`, platform.maxCaption);

  const title = buildTitle({
    topic: idea.subject,
    format: input.format,
    platform: input.platform,
    brand,
  });

  return {
    title,
    hook,
    body: sanitize(body, avoid),
    caption: sanitize(caption, avoid),
    hashtags,
    cta: sanitize(cta, avoid),
    visualDirection: sanitize(
      input.format === "image_concept"
        ? bodyByFormat.image_concept
        : buildVisualDirection(idea.subject, brand, platform.visual),
      avoid
    ),
    platform: input.platform,
    goal: input.goal,
    format: input.format,
    audience,
    storyboard,
    artboard,
    design,
  };
}

/* ---------- reading the idea ---------- */

export type ParsedIdea = {
  /** The thing itself, e.g. "Midnight Mocha". */
  subject: string;
  /** Taken from the idea's own verb. */
  action: "launch" | "announce" | "promote" | "explain";
  /** Generic category word when the idea names one ("drink"). */
  category: string | null;
  /** The clause after "that"/"which"/"so", when the user wrote one. */
  benefit: string | null;
};

const CATEGORY_WORDS = [
  "drink", "snack", "app", "service", "course", "tool", "game", "book",
  "platform", "device", "clothing", "subscription", "program", "event",
  "campaign", "software", "marketplace", "community", "newsletter",
];

/**
 * Read the user's idea for the parts a writer would actually use: what the
 * thing is called, what is being done with it, and why it exists. This is what
 * keeps the copy from repeating the raw sentence back at the reader.
 */
export function parseIdea(raw: string): ParsedIdea {
  const idea = raw.replace(/\s+/g, " ").trim();

  const action: ParsedIdea["action"] =
    /\b(launch|launching|releas|dropping|debut)/i.test(idea) ? "launch"
    : /\b(announc|reveal|unveil)/i.test(idea) ? "announce"
    : /\b(promot|sell|selling|market)/i.test(idea) ? "promote"
    : "explain";

  // Only the part before the qualifier describes the product itself — otherwise
  // "a newsletter for indie game developers" would be read as a game.
  const head = idea
    .split(/\s+(?:that|which|who|so|and|for|to)\s+/i)[0]
    .toLowerCase();
  const category =
    CATEGORY_WORDS.find((c) => new RegExp(`\\b${c}s?\\b`).test(head)) ?? null;

  // Only "that"/"which"/"so" clauses count as a stated benefit — a "for X" tail
  // is the audience, not a promise.
  const benefitMatch = idea.match(/\b(?:that|which|so)\s+([^.,;!?]{6,90})/i);

  return {
    subject: subjectOf(idea, idea.replace(/\s+/, " "), category),
    action,
    category,
    benefit: benefitMatch ? benefitMatch[1].trim().replace(/\s+$/, "") : null,
  };
}

/**
 * The product/idea name. Prefer a capitalised proper noun ("Midnight Mocha"),
 * otherwise take the noun phrase that leads the idea and stop at the verb
 * clause — "A skincare serum that calms redness" is named "A skincare serum",
 * not "A skincare serum that calms".
 */
function subjectOf(idea: string, raw: string, category: string | null): string {
  const capitalRun = idea.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/);
  if (capitalRun) return stripArticle(capitalRun[1]);

  const stripped = extractTopic(raw);
  // Everything before the describing clause is the name.
  const head = stripped.split(/\s+(?:that|which|who|so|and|to|for)\s+/i)[0].trim();

  if (category) {
    const m = head.match(new RegExp(`([a-z]+\\s+[a-z]+\\s+)?${category}s?\\b`, "i"));
    if (m) return stripArticle(m[0].trim());
  }

  const words = head.split(" ").filter(Boolean);
  if (words.length > 5) return stripArticle(words.slice(0, 5).join(" "));
  return stripArticle(head) || "your idea";
}

/** "A skincare serum" -> "skincare serum", so callers can title-case it. */
function stripArticle(s: string): string {
  return s.replace(/^(?:a|an|the|our|your|my)\s+/i, "").trim();
}

/* ---------- reading the audience ---------- */

export type ParsedAudience = {
  age: string | null;
  /** Grammatical form for prose, e.g. "18–24-year-olds". */
  ageWord: string | null;
  place: string | null;
  interests: string[];
  /** Prose-safe reference, e.g. "18–24-year-olds in India". */
  label: string | null;
  /** Line-safe summary, e.g. "18–24 · India · hostel life, exam stress". */
  line: string;
};

const AGE_ONLY = /^(\d{1,2}[-–—]\d{1,2}|\d{1,2}\+)$/;

/**
 * Split the audience the user typed into age / place / interests so it can be
 * referred to in prose instead of pasted in as a comma-separated list.
 */
export function parseAudience(raw: string | null): ParsedAudience | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const parts = trimmed
    .split(/[,;·]|\s+—\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  let age: string | null = null;
  let place: string | null = null;
  const interests: string[] = [];

  for (const part of parts) {
    const compact = part.replace(/\s+/g, "").replace(/-/g, "–");
    if (!age && AGE_ONLY.test(compact)) {
      age = compact;
      continue;
    }
    if (!place && /^(?:in|across|from)\s+/i.test(part)) {
      place = part.replace(/^(?:in|across|from)\s+/i, "").trim();
      continue;
    }
    // A lone capitalised word after an age reads as a place or group name.
    if (!place && /^[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)*$/.test(part)) {
      place = part;
      continue;
    }
    interests.push(part);
  }

  return {
    age,
    ageWord: age ? ageWord(age) : null,
    place,
    interests,
    label: labelOf(age, place, interests),
    line: ([age, place, ...interests].filter(Boolean) as string[]).join(" · "),
  };
}

function labelOf(age: string | null, place: string | null, interests: string[]): string | null {
  const who = age ? ageWord(age) : interests[0] ?? null;
  if (who && place) return `${who} in ${place}`;
  return who;
}

function ageWord(age: string): string {
  const range = age.match(/^(\d{1,2})[–-](\d{1,2})$/);
  if (range) return `${range[1]}–${range[2]}-year-olds`;
  if (/^\d{1,2}\+$/.test(age)) return `${age.slice(0, -1)}-plus`;
  return `${age}-year-olds`;
}

/** "a, b and c" */
function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/* ---------- copy composition ---------- */

function composeCaption({
  idea, aud, voice, toUse,
}: {
  idea: ParsedIdea;
  aud: ParsedAudience | null;
  voice: Voice;
  toUse: string[];
  platform: { rhythm: string };
}): string {
  const subject = titleCase(idea.subject);
  const who = aud?.label ?? null;

  const opener =
    voice.rhythm === "measured" ? `${subject} is ready.` : `${voice.open} ${subject}.`;

  // The benefit arrives in one of two shapes — an infinitive ("to help you…")
  // or a bare third-person clause ("calms redness overnight").
  const timed = idea.benefit ? idea.benefit.replace(/[.!?]+$/, "") : null;
  const why = timed
    ? /^(?:to)\s/i.test(timed)
      ? `It exists for one reason: ${timed.replace(/^to\s+/i, "")}.`
      : /^(?:it|this|that|they|you|we|there)\b/i.test(timed)
      ? `It exists for one reason: ${timed}.`
      : `It exists for one reason: it ${timed}.`
    : idea.category
    ? `It exists because most ${idea.category}s are built for someone else — this one isn't.`
    : `It exists because the version you've been sold was built for someone else.`;

  const audienceLine = who
    ? `Made for ${who}${aud?.interests.length ? ` — people who care about ${list(aud.interests.slice(0, 2))}` : ""}.`
    : "";

  const brandLine = toUse.length
    ? `You'll hear us say ${list(toUse.slice(0, 2))}. We mean both.`
    : "";

  return [opener, "", why, "", audienceLine, brandLine]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n");
}

function composePost({
  idea, aud, voice,
}: {
  idea: ParsedIdea;
  aud: ParsedAudience | null;
  voice: Voice;
  brand: string;
  platform: string;
}): string {
  const subject = titleCase(idea.subject);
  const who = aud?.label ?? null;
  const timed = idea.benefit ? idea.benefit.replace(/[.!?]+$/, "") : null;

  const substance = timed
    ? /^to\s/i.test(timed)
      ? `It is built to ${timed.replace(/^to\s+/i, "")}.`
      : /^(?:it|this|that|they|you|we|there)\b/i.test(timed)
      ? `Here is the plain version: ${timed}.`
      : `${subject} ${timed}.`
    : idea.category
    ? `Most ${idea.category}s are built for someone else. This one is not.`
    : `The version you have seen is the expensive one, not the good one.`;

  return [
    `${voice.open} ${subject}.`,
    "",
    substance,
    who ? `${subject} is for ${who}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildVisualDirection(subject: string, brand: string, platformVisual: string): string {
  return [
    `Subject: ${subject} shown in real use — no stock staging.`,
    `Framing: ${platformVisual}.`,
    `Brand: ${brand} palette and type, applied consistently.`,
    `Avoid: cluttered overlays, generic business photography, more than one focal point.`,
  ].join("\n");
}

/* ---------- storyboard ---------- */

function buildStoryboard({
  idea, aud, hook, brand, format, cta,
}: {
  idea: ParsedIdea;
  aud: ParsedAudience | null;
  hook: string;
  brand: string;
  format: string;
  cta: string;
}): StoryboardShot[] {
  const subject = titleCase(idea.subject);
  const who = aud?.label ?? "the viewer";
  const moving = isMovingFormat(format);
  const short = (s: string, n: number) => {
    if (s.length <= n) return s;
    const cut = s.slice(0, n);
    return cut.replace(/\s+\S*$/, "").replace(/[\s—–\-:,;'"]+$/, "").trimEnd() + "…";
  };

  // The promise, phrased for a shot list rather than pasted from the brief.
  // Two forms: `promise` reads inside a sentence, `promiseLine` stands alone.
  const promise = idea.benefit ? idea.benefit.replace(/^to\s+/i, "") : null;
  const promiseLine =
    promise ?? (idea.category ? "DOES THE JOB YOU ACTUALLY HAVE" : "NOT BUILT FOR THEM");

  const beats: Array<Omit<StoryboardShot, "index" | "timecode">> = moving
    ? [
        {
          shot: "Extreme close-up, handheld, natural light",
          onScreen: subject.toUpperCase().slice(0, 28),
          voiceover: hook,
          transition: "hard cut",
        },
        {
          shot: `Medium shot — ${subject.toLowerCase()} in real use`,
          onScreen: "THE PROBLEM, IN ONE LINE",
          voiceover: idea.category
            ? `Most ${idea.category}s are built for someone else. This one isn't.`
            : `Here's the part everyone skips.`,
          transition: "match cut",
        },
        {
          shot: "Macro detail — the single thing that proves it works",
          onScreen: short(promiseLine, 42),
          voiceover: promise
            ? `${subject} was made to ${promise}.`
            : `${subject} does the job you actually have.`,
          transition: "whip pan",
        },
        {
          shot: (() => {
            // Only add an interest that says something the label doesn't.
            const extra = aud?.interests.find(
              (it) => who && !who.toLowerCase().includes(it.toLowerCase())
            );
            return extra
              ? `Candid: ${who}, unscripted — ${extra}`
              : `Candid: ${who}, unscripted`;
          })(),
          onScreen: "THE BIT THEY REMEMBER",
          voiceover: `${titleCase(who)} don't need convincing — they need this to exist.`,
          transition: "speed ramp",
        },
        {
          shot: "Product lockup, logo lower-right",
          onScreen: brand,
          voiceover: `${brand}. ${subject}, out now.`,
          transition: "dip to black",
        },
        {
          shot: "End card, loop point matches frame 1",
          onScreen: short(cta, 38),
          voiceover: cta,
          transition: "loop",
        },
      ]
    : [
        {
          shot: "Hero shot, centred, single subject",
          onScreen: subject.toUpperCase().slice(0, 30),
          voiceover: "—",
          transition: "static",
        },
        {
          shot: "Detail crop showing texture / proof",
          onScreen: short(promiseLine, 44),
          voiceover: "—",
          transition: "static",
        },
        {
          shot: "End card with CTA block",
          onScreen: short(cta, 38),
          voiceover: "—",
          transition: "static",
        },
      ];

  let cursor = 0;
  return beats.map((b, i) => {
    const from = cursor;
    cursor += 3;
    const timecode = moving ? `${fmt(from)}–${fmt(cursor)}` : "—";
    return { index: i + 1, timecode, ...b };
  });
}

/** Trim to a character budget on a word boundary, keeping the tail (the CTA). */
function trimTo(text: string, max: number): string {
  if (text.length <= max) return text;
  const ctaMatch = text.match(/\n\n([^\n]+)$/);
  const tail = ctaMatch ? `\n\n${ctaMatch[1]}` : "";
  const headBudget = Math.max(40, max - tail.length);
  const head = text.slice(0, headBudget).replace(/\s+\S*$/, "").trimEnd();
  return `${head}${tail}`;
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function storyboardToScript(shots: StoryboardShot[]): string {
  return shots
    .map(
      (s) =>
        `[SHOT ${s.index} — ${s.timecode}] (${s.transition})\n` +
        `VISUAL: ${s.shot}\n` +
        `ON SCREEN: ${s.onScreen}\n` +
        `VO: ${s.voiceover}`
    )
    .join("\n\n");
}

function storyboardToCarousel(shots: StoryboardShot[]): string {
  return shots
    .map((s, i) =>
      i === 0
        ? `Slide 1 (hook): ${s.onScreen}`
        : i === shots.length - 1
        ? `Slide ${i + 1} (CTA): ${s.onScreen}`
        : `Slide ${i + 1}: ${s.onScreen}`
    )
    .join("\n");
}

/* ---------- hashtags ---------- */

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "can", "did",
  "do", "does", "for", "from", "had", "has", "have", "how", "i", "in", "into",
  "is", "it", "its", "just", "like", "make", "makes", "made", "more", "most",
  "my", "new", "not", "of", "on", "or", "our", "out", "over", "so", "some",
  "that", "the", "their", "them", "then", "there", "these", "they", "this",
  "to", "up", "us", "was", "we", "were", "what", "when", "which", "who", "why",
  "will", "with", "you", "your", "about", "after", "all", "also", "because",
  "get", "gets", "got", "one", "two", "now", "still", "very", "well",
]);

/**
 * Build a hashtag set that reflects *this* idea and brand, not the platform's
 * generic filler. Terms drawn from the topic and the profile's preferred words
 * come first; the platform defaults are only padding and are dropped entirely
 * when the topic already yielded enough terms.
 */
function buildHashtags(
  topic: string,
  brand: string,
  toUse: string[],
  platform: { hashtags: string[] }
): string[] {
  // #oneword — keeps hashtags readable for multi-word phrases.
  const slug = (s: string) => s.replace(/[^\w\s]/g, "").replace(/\s+/g, "").toLowerCase();

  const terms: string[] = [];

  const addPhrase = (phrase: string) => {
    const words = phrase
      .split(/\s+/)
      .map((w) => w.replace(/[^\w]/g, ""))
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));
    // Keep the joined tag short enough to stay readable, and carry the lead
    // word separately so multi-word phrases still produce a usable tag.
    const joined = words.slice(0, 2).join("");
    if (joined.length > 0 && joined.length <= 20) terms.push(joined);
    if (words.length > 1) terms.push(words[0]);
  };

  // Idea first (the full phrase then its lead word), then brand, then voice words.
  addPhrase(topic);
  // "your brand" is the placeholder used when no profile is selected.
  if (!/^your\s/i.test(brand)) addPhrase(brand);
  for (const w of toUse) addPhrase(w);

  const topicTags = [...new Set(terms)]
    .filter(Boolean)
    .slice(0, 6)
    .map((t) => `#${slug(t)}`);

  // Named brands and products are the strongest tags — capitalise known terms.
  const properNouns = (topic.match(/\b[A-Z][a-z]{2,}\b/g) ?? [])
    .map((w) => w.toLowerCase())
    .filter((w) => w !== "brand" && !STOP_WORDS.has(w))
    .map((w) => `#${slug(w)}`);

  const base = [...new Set([...properNouns, ...topicTags])].filter((h) => h.length > 3);

  // Only pad with the platform's generic tags if the idea produced few tags.
  const filler = base.length >= 5 ? [] : platform.hashtags;

  return [...new Set([...base, ...filler])]
    .map((h) => h.replace(/#$/, ""))
    .filter((h) => h.length > 3)
    .slice(0, 8);
}

/* ---------- artboard + title ---------- */

function buildArtboard({
  idea, aud, hook, cta, brand, seed, profile, platform, variant,
}: {
  idea: ParsedIdea;
  aud: ParsedAudience | null;
  hook: string;
  cta: string;
  brand: string;
  seed: number;
  profile: GenerationInput["profile"];
  platform: string;
  variant: number;
}): ArtboardSpec {
  const layouts: ArtboardSpec["layout"][] = ["split", "centered", "stacked"];
  const motifs: ArtboardSpec["motif"][] = ["circles", "grid", "waves", "burst"];
  const aspect: ArtboardSpec["aspect"] =
    platform === "YouTube" || platform === "X" ? "landscape"
    : platform === "Instagram" ? "portrait"
    : "square";

  return {
    headline: titleCase(idea.subject).slice(0, 44),
    subhead: aud?.label ? `For ${aud.label}` : hook.slice(0, 60),
    cta: cta.split(/[.!?]/)[0].slice(0, 34) || brand,
    palette: paletteFor(profile, seed + variant),
    layout: layouts[(seed + variant) % layouts.length],
    motif: motifs[(seed + variant) % motifs.length],
    aspect,
    artDirection: `${brand} brand system · ${platform}-native · one focal point, generous negative space, no stock photography`,
  };
}

function buildTitle({
  topic, format, platform, brand,
}: {
  topic: string;
  format: string;
  platform: string;
  brand: string;
}): string {
  const labels: Record<string, string> = {
    video_script: "Reel script",
    reel: "Reel",
    animation: "Animated concept",
    carousel: "Carousel",
    image_concept: "Visual concept",
    post: "Post",
    captions: "Caption",
    hooks: "Hook pack",
    hashtags: "Hashtag set",
    headline: "Headline",
    cta_only: "Call to action",
  };
  const label = labels[format] ?? format.replace(/_/g, " ");
  return `${label} — ${titleCase(topic)} · ${brand === "your brand" ? platform : brand}`;
}

/* ---------- brand-safety hygiene ---------- */

/** Never emit a word the brand has asked us to avoid. */
function sanitize(text: string, avoid: string[]): string {
  if (!avoid.length) return text;
  let out = text;
  for (const word of avoid) {
    if (!word) continue;
    out = out.replace(new RegExp(`\\b${escapeRe(word)}\\b`, "gi"), "—");
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}