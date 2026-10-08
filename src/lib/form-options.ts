/**
 * Shared form options — the single source of truth for every dropdown in the
 * Create Studio, the Compare form, and the profile editor.
 *
 * Rules:
 *  - values are what the generation pipeline already understands (platform
 *    keys match PLATFORM_CONSTRAINTS in prompt.ts; format keys match the
 *    format branches in generate.ts/quality.ts) — adding an option never
 *    changes pipeline behaviour;
 *  - fields where users type free-form detail stay free text (the idea,
 *    audience interests, brand guidelines…) — a dropdown there would throw
 *    away real information;
 *  - every list ends with an escape hatch: "Other" (or a free-text field next
 *    to a select) so no one is boxed into the presets.
 */

/* ---- platforms ----
 * The first five drive real platform-specific prompt rules
 * (PLATFORM_CONSTRAINTS). The rest are valid choices too — the pipeline
 * treats any unknown platform generically, so new options are safe.
 */
export const PLATFORMS = [
  "Instagram",
  "LinkedIn",
  "YouTube",
  "Facebook",
  "X",
  "TikTok",
  "Pinterest",
  "Threads",
  "WhatsApp",
  "Snapchat",
  "Other",
] as const;

/* ---- content goals ---- */
export const GOALS = [
  "Awareness",
  "Engagement",
  "Followers",
  "Education",
  "Leads",
  "Sales",
  "Product launch",
  "Reach",
  "Other",
] as const;

/* ---- content formats ----
 * value must be a key the pipeline knows (FORMAT_INSTRUCTIONS in prompt.ts /
 * the format branches in generate.ts). label is what the user sees.
 */
export const FORMATS = [
  { value: "captions", label: "Caption" },
  { value: "post", label: "Full post draft" },
  { value: "hooks", label: "Hooks (5 options)" },
  { value: "hashtags", label: "Hashtag set" },
  { value: "reel", label: "Reel — script + storyboard" },
  { value: "video_script", label: "Short-form video script" },
  { value: "animation", label: "Animation concept" },
  { value: "carousel", label: "Carousel outline" },
  { value: "image_concept", label: "Image / visual concept" },
  { value: "story", label: "Story (sequential frames)" },
  { value: "blog", label: "Blog intro / outline" },
  { value: "email", label: "Email / newsletter" },
  { value: "headline", label: "Headline (5 options)" },
  { value: "cta_only", label: "Call to action (5 options)" },
  { value: "other", label: "Other (describe in the idea)" },
] as const;

/* ---- age ranges (audience) ---- */
export const AGE_RANGES = [
  "Under 18",
  "18–24",
  "25–34",
  "35–44",
  "45–54",
  "55–64",
  "65+",
  "Mixed / all ages",
  "Other",
] as const;

/* ---- audience interests — common presets; the field stays open to typing ---- */
export const INTERESTS = [
  "Fitness & gym",
  "Food & cooking",
  "Travel",
  "Fashion & style",
  "Technology",
  "Gaming",
  "Beauty & skincare",
  "Finance & investing",
  "Education & careers",
  "Startups & business",
  "Movies & entertainment",
  "Music",
  "Photography",
  "Home & decor",
  "Parenting",
  "Sustainability",
] as const;

/* ---- tone ---- */
export const TONES = [
  "Friendly & casual",
  "Professional & formal",
  "Bold & punchy",
  "Warm & storytelling",
  "Witty & playful",
  "Minimal & direct",
] as const;

/* ---- languages ---- */
export const LANGUAGES = [
  "English",
  "Hindi",
  "Hinglish",
  "Spanish",
  "German",
  "Other",
] as const;

/* ---- calls to action — preset CTAs to ask the model for ---- */
export const CTA_PRESETS = [
  "Visit our website",
  "DM us for details",
  "Comment below",
  "Sign up today",
  "Try it free",
  "Shop the drop",
  "Save this post",
  "Share with a friend",
  "Book a demo",
  "Link in bio",
] as const;

/** "Other" handling helpers — a select that allows a custom value. */
export function isOther(value: string): boolean {
  return value.trim().toLowerCase() === "other";
}

/** Trim a picked-or-typed value for saving. */
export function normalizeChoice(value: string): string {
  return value.trim();
}