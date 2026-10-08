/**
 * Prompt construction for real LLM generation.
 *
 * This is where Draftly's product promise lives: the prompt carries the brand
 * voice, the analysed style traits, the audience, the platform's real
 * constraints, and the campaign goal — and asks for structured output that
 * matches our GenerationInput contract exactly.
 */

import type { GenerationInput, GeneratedDraft, ImageGenerationInput } from "./generate";
import { isMovingFormat } from "./generate";

export const SYSTEM_PROMPT = `You are Draftly, a senior social media content strategist and copywriter.

You write like a sharp human strategist, never like a generic AI assistant.

Hard rules:
- Obey the brand voice instructions and the words to avoid.
- Never open with "In today's fast-paced world", "Unlock the power of", "Game-changer", "Dive into", "Elevate your", or "Take it to the next level".
- No em-dash chains, no "It's not just X, it's Y" constructions.
- Do not invent statistics, awards, customer numbers, prices, or dates. If a concrete proof point would help but you don't have one, write a placeholder in square brackets instead, e.g. [add your launch date].
- Do not claim the content has performed well or will drive specific engagement numbers.
- Respect the platform's real constraints (length, tone, hashtag norms).
- Return ONLY valid JSON. No prose before or after, no markdown fences.`;

/** Describe the brand voice precisely enough for a model to imitate it. */
function brandVoiceBlock(profile: GenerationInput["profile"]): string {
  if (!profile) {
    return `BRAND VOICE: none supplied. Write platform-native, neutral-professional copy.
Because there is no brand voice, do NOT pretend to have learned one.`;
  }

  const lines: string[] = [`BRAND VOICE — ${profile.name}`];
  const add = (label: string, value?: string | null) => {
    if (value && value.trim()) lines.push(`- ${label}: ${value.trim()}`);
  };

  add("What they do", profile.description ?? null);  add("Niche", profile.niche);
  add("Products/services", profile.offerings);
  add("Their audience", profile.audience);
  add("Preferred tone", profile.tone);
  add("Language", profile.language);
  add("Words/phrases to USE", profile.wordsToUse);
  add("Words/phrases to AVOID", profile.wordsToAvoid);
  add("Brand guidelines", profile.guidelines);
  add("Brand colours", profile.colors);

  if (profile.styleAnalysis) {
    try {
      const a = JSON.parse(profile.styleAnalysis) as Record<string, unknown>;
      const overrides = (a.overrides ?? {}) as Record<string, string>;
      const merged = { ...a, ...overrides };
      delete (merged as Record<string, unknown>).overrides;
      const traits = Object.entries(merged)
        .filter(([, v]) => typeof v === "string")
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      if (traits) {
        lines.push(`- Measured style from their own past posts: ${traits}`);
        lines.push(
          `  (Mirror these measured traits. They were computed from the brand's real writing.)`
        );
      }
    } catch {
      // A malformed analysis simply isn't included.
    }
  }

  return lines.join("\n");
}

const PLATFORM_CONSTRAINTS: Record<string, string> = {
  Instagram: `Instagram: caption under 2200 chars, first line is the hook and must work before the "more" cut. 3–5 relevant hashtags, not 30. Emoji used sparingly, never as bullet points. Reels favour spoken-word hooks under 8 words.`,
  LinkedIn: `LinkedIn: up to 3000 chars but the first 2 lines decide everything. Professional, specific, no hashtag spam (max 3). No emoji spam. Story-led with a concrete takeaway.`,
  YouTube: `YouTube: written for the ear. Hook in the first 5 seconds. Clear signposting between beats. Spoken rhythm, contractions, short sentences.`,
  Facebook: `Facebook: conversational, community-first, medium length. Optimise for comments and shares. Minimal hashtags.`,
  X: `X: under 280 characters for the main post. One sharp idea. No hashtag stuffing (0–2 max). Every word must earn its place.`,
};

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  captions: "Write a full caption: a scroll-stopping first line, tight middle, and a closing line that invites a response.",
  hooks: 'Return 5 genuinely different opening hooks in "body", separated by blank lines. Vary the angle: curiosity, contrarian, specific-number, direct-address, story drop.',
  hashtags: "Focus on a researched-sounding, well-mixed hashtag set: 2 broad, 4 niche, 2 branded. Put them in the hashtags array.",
  video_script: "Write a spoken short-form video script in `body`, beat by beat, with timings.",
  carousel: "Write a slide-by-slide carousel plan in `body` (6–8 slides), slide 1 being the hook and the last being the CTA.",
  image_concept: "Describe one specific, art-directable still image in `body`: subject, framing, lighting, props, text overlay, and what NOT to include.",
  headline: "Write 5 distinct headline options in `body`, from safe to bold.",
  cta_only: "Write 5 different calls to action in `body`, matched to the goal.",
  post: "Write a complete, ready-to-publish post in `body`.",
  reel: "Write a vertical short-form reel plan in `body` with a spoken script and shot notes.",
  animation: "Write an animated motion-graphics concept in `body`: what moves, on what beat, and the loop point.",
  story: "Write a 3–5 frame story sequence in `body` (frame, overlay text, why it works), ending on the CTA frame.",
  blog: "Write the opening section of a blog post in `body`: a hook paragraph, a short outline of the sections that follow, and the first section in full.",
  email: "Write a short email in `body`: a subject line, a preview line, and a body of at most four short paragraphs ending in the CTA.",
  other: "Use the user's idea to choose the most useful shape for this piece, and say what shape you chose in the first line of `body`.",
};

export function buildUserPrompt(input: GenerationInput): string {
  const moving = isMovingFormat(input.format);
  const variantNote =
    input.variant > 0
      ? `\nThis is alternative version #${input.variant + 1}. Use a genuinely DIFFERENT angle, structure and opening than the obvious first idea — do not paraphrase version 1.`
      : "";

  const storyboardInstruction = moving
    ? `Return 5–8 shots. Timecodes must be realistic for a 20–30s vertical video, starting at 0:00.
For each shot, "shot" is camera framing and direction (be specific: lens, movement, lighting), "onScreen" is the text overlay (max 6 words), "voiceover" is the exact spoken line, "transition" is the edit between this shot and the next.`
    : `Return 3 shots describing the still-image plan: the hero frame, a detail frame showing proof, and an end card carrying the CTA. Use "—" for timecode, "static" for transition, and "—" for voiceover.`;

  return `TASK: create ${input.format.replace(/_/g, " ")} content for ${input.platform}.

THE IDEA (from the user, verbatim):
"""
${input.idea}
"""

${brandVoiceBlock(input.profile)}

TARGET AUDIENCE (supplied by the user — do not assume anything beyond this):
${input.audience || input.profile?.audience || "Not specified. Write for a general but specific-feeling audience; do not invent demographics."}

PLATFORM: ${PLATFORM_CONSTRAINTS[input.platform] ?? input.platform}

CAMPAIGN GOAL: ${input.goal}. The call to action must serve this goal specifically.

FORMAT: ${FORMAT_INSTRUCTIONS[input.format] ?? input.format}

VISUAL / DESIGN:
Also art-direct the accompanying visual. Choose a palette that suits the brand (use the brand's own colours if given). Describe layout, typography and motion for this platform.${variantNote}

Return JSON with EXACTLY this shape:
{
  "title": "short internal title for this piece",
  "hook": "the single strongest opening line",
  "body": "the main content, formatted for the platform with blank lines between blocks",
  "caption": "the ready-to-paste caption (may equal body for caption formats)",
  "hashtags": ["#example", "#example2"],
  "cta": "one clear call to action",
  "visualDirection": "art-direction notes for whoever makes the visual",
  "storyboard": [
    {
      "index": 1,
      "timecode": "0:00–0:03",
      "shot": "camera framing / direction",
      "onScreen": "text overlay",
      "voiceover": "spoken line",
      "transition": "cut"
    }
  ],
  "artboard": {
    "headline": "max 6 words",
    "subhead": "max 10 words",
    "cta": "max 5 words",
    "palette": { "bg": "#0f0b1e", "surface": "#1a1430", "fg": "#f4f2ff", "accent": "#8b5cf6", "accent2": "#22d3ee" },
    "layout": "split | centered | stacked",
    "motif": "circles | grid | waves | burst",
    "aspect": "square | portrait | landscape",
    "artDirection": "one sentence of art direction"
  },
  "design": {
    "palette": ["#hex", "#hex", "#hex"],
    "typography": "type treatment",
    "layout": "layout principle",
    "motion": "motion principle"
  }
}

${storyboardInstruction}

JSON only. No markdown fences. No commentary.`;
}

/**
 * Coerce whatever the model returned into a valid GeneratedDraft.
 *
 * Models get most fields right and occasionally miss or misname one. Filling
 * gaps from the deterministic generator keeps the app working without ever
 * pretending missing AI output was AI output — anything filled in is a
 * structural default, not invented copy.
 */
export function coerceDraft(
  raw: unknown,
  input: GenerationInput,
  fallback: GeneratedDraft
): GeneratedDraft {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fb: string): string =>
    typeof v === "string" && v.trim() ? v.trim() : fb;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

  const storyboard = Array.isArray(r.storyboard)
    ? (r.storyboard as Array<Record<string, unknown>>)
        .slice(0, 12)
        .map((s, i) => ({
          index: typeof s.index === "number" ? s.index : i + 1,
          timecode: str(s.timecode, fallback.storyboard[i]?.timecode ?? "—"),
          shot: str(s.shot, ""),
          onScreen: str(s.onScreen, ""),
          voiceover: str(s.voiceover, "—"),
          transition: str(s.transition, "cut"),
        }))
        .filter((s) => s.shot || s.onScreen)
    : [];

  const artboardRaw = (r.artboard ?? {}) as Record<string, unknown>;
  const paletteRaw = (artboardRaw.palette ?? {}) as Record<string, unknown>;
  const hex = (v: unknown, fb: string): string =>
    typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : fb;

  const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fb: T): T =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fb;

  const designRaw = (r.design ?? {}) as Record<string, unknown>;

  return {
    title: str(r.title, fallback.title),
    hook: str(r.hook, fallback.hook),
    body: str(r.body, fallback.body),
    caption: str(r.caption, fallback.caption),
    hashtags: arr(r.hashtags).length ? arr(r.hashtags).slice(0, 12) : fallback.hashtags,
    cta: str(r.cta, fallback.cta),
    visualDirection: str(r.visualDirection, fallback.visualDirection),
    platform: input.platform,
    goal: input.goal,
    format: input.format,
    audience: input.audience || input.profile?.audience || null,
    storyboard: storyboard.length ? storyboard : fallback.storyboard,
    artboard: {
      headline: str(artboardRaw.headline, fallback.artboard.headline),
      subhead: str(artboardRaw.subhead, fallback.artboard.subhead),
      cta: str(artboardRaw.cta, fallback.artboard.cta),
      palette: {
        bg: hex(paletteRaw.bg, fallback.artboard.palette.bg),
        surface: hex(paletteRaw.surface, fallback.artboard.palette.surface),
        fg: hex(paletteRaw.fg, fallback.artboard.palette.fg),
        accent: hex(paletteRaw.accent, fallback.artboard.palette.accent),
        accent2: hex(paletteRaw.accent2, fallback.artboard.palette.accent2),
      },
      layout: oneOf(artboardRaw.layout, ["split", "centered", "stacked"] as const, fallback.artboard.layout),
      motif: oneOf(artboardRaw.motif, ["circles", "grid", "waves", "burst"] as const, fallback.artboard.motif),
      aspect: oneOf(artboardRaw.aspect, ["square", "portrait", "landscape"] as const, fallback.artboard.aspect),
      artDirection: str(artboardRaw.artDirection, fallback.artboard.artDirection),
    },
    design: {
      palette: arr(designRaw.palette).length ? arr(designRaw.palette).slice(0, 6) : fallback.design.palette,
      typography: str(designRaw.typography, fallback.design.typography),
      layout: str(designRaw.layout, fallback.design.layout),
      motion: str(designRaw.motion, fallback.design.motion),
    },
  };
}

/**
 * User prompt for IMAGE-BASED generation.
 *
 * The image itself is attached separately (see llm.completeWithImage); this
 * text tells the model what the image is and what to do with it. Reuses the
 * brand-voice, audience, platform and format blocks from buildUserPrompt so
 * image drafts follow exactly the same product rules as text drafts.
 */
export function buildImageUserPrompt(input: ImageGenerationInput): string {
  const moving = isMovingFormat(input.format);
  const storyboardInstruction = moving
    ? `Return 5–8 shots. Timecodes must be realistic for a 20–30s vertical video, starting at 0:00.
For each shot, "shot" is camera framing and direction (be specific: lens, movement, lighting), "onScreen" is the text overlay (max 6 words), "voiceover" is the exact spoken line, "transition" is the edit between this shot and the next.`
    : `Return 3 shots describing the still-image plan: the hero frame, a detail frame showing proof, and an end card carrying the CTA. Use "—" for timecode, "static" for transition, and "—" for voiceover.`;

  return `TASK: create ${input.format.replace(/_/g, " ")} content for ${input.platform}, based on the attached image.

THE IMAGE: the user uploaded the image attached to this message. Base the content on what is actually visible in it — describe, reference, or extend the real subject, product, mood or setting shown. Do not invent a different product or scene, and do not fall back to generic copy if the image is clear enough to work from.

WHAT THE USER WANTS DONE WITH THE IMAGE:
"""
${input.instructions}
"""

${brandVoiceBlock(input.profile)}

TARGET AUDIENCE (supplied by the user — do not assume anything beyond this):
${input.audience || input.profile?.audience || "Not specified. Write for a general but specific-feeling audience; do not invent demographics."}

PLATFORM: ${PLATFORM_CONSTRAINTS[input.platform] ?? input.platform}

CAMPAIGN GOAL: ${input.goal}. The call to action must serve this goal specifically.

TONE & LANGUAGE: write in ${input.language}, with a ${input.tone} tone.

FORMAT: ${FORMAT_INSTRUCTIONS[input.format] ?? input.format}

VISUAL / DESIGN:
Also art-direct the accompanying visual. You may build on the uploaded image's palette, subject and mood, or propose how to adapt it for the platform. Describe layout, typography and motion for this platform.

Return JSON with EXACTLY this shape:
{
  "title": "short internal title for this piece",
  "hook": "the single strongest opening line",
  "body": "the main content, formatted for the platform with blank lines between blocks",
  "caption": "the ready-to-paste caption (may equal body for caption formats)",
  "hashtags": ["#example", "#example2"],
  "cta": "one clear call to action",
  "visualDirection": "art-direction notes for whoever makes the visual",
  "storyboard": [
    {
      "index": 1,
      "timecode": "0:00–0:03",
      "shot": "camera framing / direction",
      "onScreen": "text overlay",
      "voiceover": "spoken line",
      "transition": "cut"
    }
  ],
  "artboard": {
    "headline": "max 6 words",
    "subhead": "max 10 words",
    "cta": "max 5 words",
    "palette": { "bg": "#0f0b1e", "surface": "#1a1430", "fg": "#f4f2ff", "accent": "#8b5cf6", "accent2": "#22d3ee" },
    "layout": "split | centered | stacked",
    "motif": "circles | grid | waves | burst",
    "aspect": "square | portrait | landscape",
    "artDirection": "one sentence of art direction"
  },
  "design": {
    "palette": ["#hex", "#hex", "#hex"],
    "typography": "type treatment",
    "layout": "layout principle",
    "motion": "motion principle"
  }
}

${storyboardInstruction}

JSON only. No markdown fences. No commentary.`;
}
