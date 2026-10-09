/** Shared onboarding options (used by the wizard and its server actions). */

export const ROLES = [
  "Influencer / Creator",
  "Brand / Business",
  "Startup",
  "Small Business",
  "Personal Brand",
  "Individual / Student",
  "Other",
] as const;

/** One plain-language line per role so the first onboarding question is
 *  answerable without guessing what each option means. */
export const ROLE_HINTS: Record<(typeof ROLES)[number], string> = {
  "Influencer / Creator": "You make content for an audience — reels, posts, videos.",
  "Brand / Business": "A company or product with a marketing voice.",
  Startup: "A young company finding its voice and first customers.",
  "Small Business": "A local shop or service promoting what you sell.",
  "Personal Brand": "Building a name around yourself — coaching, portfolio, thought leadership.",
  "Individual / Student": "Posting for growth, a portfolio, or just for fun.",
  Other: "Something else — you can describe it in your profile later.",
};

export const GOALS = [
  "Increase reach",
  "Increase engagement",
  "Grow followers",
  "Build brand awareness",
  "Launch a product",
  "Generate leads",
  "Increase sales",
  "Publish consistently",
] as const;

export const PLATFORMS = ["Instagram", "LinkedIn", "YouTube", "Facebook", "X"] as const;

export const LANGUAGES = ["English", "Hindi", "Hinglish", "Spanish", "German", "Other"] as const;

export const TONES = [
  "Friendly & casual",
  "Professional & formal",
  "Bold & punchy",
  "Warm & storytelling",
  "Witty & playful",
  "Minimal & direct",
] as const;
