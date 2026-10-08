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
