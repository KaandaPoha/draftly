/**
 * "Why This Draft?" — explanations derived strictly from the inputs that
 * actually produced the draft. Never speculative: every bullet maps to a
 * concrete field the user chose or a value stored on their profile.
 */

import type { GenerationInput } from "./generate";

export type WhyExplanation = {
  bullets: string[];
};

export function explainDraft(input: GenerationInput, profileTone?: string | null): WhyExplanation {
  const bullets: string[] = [];
  const { platform, goal, format } = input;
  const audience = input.audience || input.profile?.audience || null;
  const tone = profileTone ?? input.profile?.tone ?? null;

  // Audience explanations
  if (audience) {
    bullets.push(
      `The draft speaks directly to your selected audience (${audience}) — the wording and examples are aimed at them.`
    );
  } else {
    bullets.push(
      "No audience was specified, so the draft uses general wording instead of assuming demographics."
    );
  }

  // Platform explanations
  const platformNotes: Record<string, string> = {
    Instagram:
      "Instagram favors short, scannable text with strong visual pairing — the hook and caption are kept brief with line breaks.",
    LinkedIn:
      "LinkedIn rewards a story-led, professional-but-human structure, so the draft reads as narrative rather than an ad.",
    YouTube:
      "YouTube scripts are written for spoken delivery with clear time cues (hook → beats → close).",
    Facebook:
      "Facebook posts skew conversational and community-focused, so the tone is warmer and less clipped.",
    X: "X posts are constrained to one sharp idea with no filler, so the draft stays under 280 characters.",
  };
  bullets.push(platformNotes[platform] ?? `The draft follows ${platform} conventions.`);

  // Format explanations
  const formatNotes: Record<string, string> = {
    captions: "You picked the caption format, so the body is a ready-to-paste caption rather than a script or outline.",
    hooks: "You picked the hooks format, so output is a set of alternative opening lines to test.",
    hashtags: "You picked hashtags only, so the draft focuses on a relevant tag set.",
    video_script: "You picked a video script, so the content is structured with time cues for filming.",
    carousel: "You picked a carousel, so the content is an outline broken slide by slide.",
    image_concept: "You picked a visual concept, so the output describes composition, palette, and staging.",
    headline: "You picked a headline, so the output is a single strong title line.",
    cta_only: "You picked CTA only, so the output is just the closing call to action.",
    post: "You picked a full post draft, so hook, body, and CTA are composed together.",
  };
  if (formatNotes[format]) bullets.push(formatNotes[format]);

  // Goal explanations
  const goalNotes: Record<string, string> = {
    Engagement: "Your goal is engagement, so the CTA asks a question to invite replies rather than pushing a link.",
    Followers: "Your goal is followers, so the CTA invites the reader to follow for more on this topic.",
    Leads: "Your goal is leads, so the CTA points to a resource behind a link.",
    Sales: "Your goal is sales, so the CTA drives to purchase.",
    Education: "Your goal is education, so the CTA encourages saving the post for later.",
    Awareness: "Your goal is awareness, so the CTA stays soft and invites learning more.",
    "Product launch": "Your goal is a product launch, so the copy leads with what's new.",
  };
  if (goalNotes[goal]) bullets.push(goalNotes[goal]);

  // Profile/tone explanations
  if (input.profile) {
    if (tone) {
      bullets.push(`The saved profile “${input.profile.name}” uses a ${tone.toLowerCase()} tone, so the opening line matches it.`);
    } else {
      bullets.push(`The draft uses the voice of your saved profile “${input.profile.name}”.`);
    }
    const wordsToUse = (input.profile.wordsToUse ?? "")
      .split(/[,;]/)
      .map((w) => w.trim())
      .filter(Boolean);
    if (wordsToUse.length > 0) {
      bullets.push(
        `Your profile lists specific words to use (${wordsToUse.slice(0, 3).join(", ")}${wordsToUse.length > 3 ? "…" : ""}), which are woven into the copy.`
      );
    }
  } else {
    bullets.push(
      "No brand profile was selected — this draft is generic. Compare it with a personalized version to see the difference."
    );
  }

  return { bullets };
}
