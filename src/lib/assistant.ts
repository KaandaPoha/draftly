/**
 * Assistant engine — profile-aware responses.
 *
 * Demo mode: since no LLM key is configured, replies come from scenario
 * templates that use the user's REAL saved context (role, goals, platforms,
 * tone, profiles). Every reply is labeled as demo output in the UI.
 *
 * Real LLM integration: when AI_API_KEY/AI_PROVIDER are set, buildChatPrompt
 * produces the full prompt from the same context — the transport-agnostic
 * part is shared.
 */

import type { UserPreferences, BrandProfile } from "@prisma/client";

export type AssistantContext = {
  userName: string | null;
  preferences: UserPreferences | null;
  profiles: Array<Pick<BrandProfile, "name" | "niche" | "tone" | "audience" | "wordsToUse">>;
  recentDrafts: Array<{ title: string; platform: string; goal: string | null }>;
};

export type AssistantReply = {
  text: string;
  scenarios: string[]; // suggested follow-up chips
  source: "demo" | "ai";
};

/* ---------- shared context block (used by demo + future LLM) ---------- */

export function buildChatPrompt(message: string, ctx: AssistantContext): string {
  const lines: string[] = [];
  lines.push("You are Draftly's assistant, helping with content strategy.");
  if (ctx.userName) lines.push(`The user's name is ${ctx.userName}.`);
  if (ctx.preferences) {
    lines.push(`They are a ${ctx.preferences.role ?? "creator"} whose goals are: ${ctx.preferences.goals ?? "not set"}.`);
    lines.push(`Active platforms: ${ctx.preferences.platforms ?? "not set"}. Preferred tone: ${ctx.preferences.tone ?? "not set"}.`);
  }
  if (ctx.profiles.length > 0) {
    lines.push("Their brand profiles:");
    ctx.profiles.forEach((p) => {
      lines.push(`- ${p.name}${p.niche ? ` (${p.niche})` : ""}${p.tone ? `, tone: ${p.tone}` : ""}`);
    });
  }
  if (ctx.recentDrafts.length > 0) {
    lines.push("Recent drafts:");
    ctx.recentDrafts.slice(0, 5).forEach((d) => {
      lines.push(`- ${d.title} (${d.platform})`);
    });
  }
  lines.push(`\nUser asks: ${message}`);
  return lines.join("\n");
}

/* ---------- demo scenarios ---------- */

function weekPlan(ctx: AssistantContext): string {
  const platform = (ctx.preferences?.platforms ?? "Instagram,LinkedIn").split(",")[0]?.trim() || "Instagram";
  const niche = ctx.profiles[0]?.niche ?? "your niche";
  const tone = (ctx.preferences?.tone ?? "friendly").toLowerCase();

  return [
    `Here's a starter week for ${platform.toLowerCase()} — built for ${niche}, in your ${tone} style:`,
    ``,
    `**Mon** — Educational post: answer the #1 question your audience asks about ${niche}.`,
    `**Tue** — Behind-the-scenes: how you make/prepare what you sell.`,
    `**Wed** — Audience question: post a poll and reply with a short follow-up the next day.`,
    `**Thu** — Story post tied to your goals (${ctx.preferences?.goals?.split(",")[0]?.trim() || "growth"}).`,
    `**Fri** — Repurpose your best-performing draft from the library.`,
    ``,
    `Posting times are estimates — real times come from your account analytics once connected.`,
  ].join("\n");
}

function audienceIdeas(ctx: AssistantContext): string {
  const audience = ctx.profiles[0]?.audience ?? "your audience";
  return [
    `Ideas for ${audience}:`,
    ``,
    `1. **Myth vs. reality carousel** — pick one misconception in your niche and correct it slide by slide.`,
    `2. **"Day in the life" story** — personal, low-production, builds trust.`,
    `3. **Before/after transformation** — proof beats promises.`,
    `4. **Answer the objection** — take the #1 reason people don't buy/subscribe and address it head-on.`,
    ``,
    `Ask "create this idea" on any of these and I'll set up the studio for you.`,
  ].join("\n");
}

function improveDraft(ctx: AssistantContext): string {
  const draft = ctx.recentDrafts[0];
  if (!draft) {
    return "You haven't saved any drafts yet. Generate one in the Create Studio first, then come back and I'll suggest improvements.";
  }
  return [
    `Ways to improve “${draft.title}”:`,
    ``,
    `1. **Tighten the hook** — cut the first 3 words; open on the strongest claim.`,
    `2. **One idea per post** — if the draft makes two points, split it into two posts.`,
    `3. **Specificity beats adjectives** — replace "great quality" with a concrete detail.`,
    `4. **CTA clarity** — one action only; pick reply, save, or link, not all three.`,
    ``,
    `Open the draft from your library and use the improvement actions — "Shorter", "More professional", "Improve the CTA" — each keeps the previous version in history.`,
  ].join("\n");
}

function campaignIdeas(ctx: AssistantContext): string {
  const niche = ctx.profiles[0]?.niche ?? "your brand";
  return [
    `Campaign themes for ${niche}:`,
    ``,
    `1. **Launch countdown** — 5 posts over 5 days, each revealing one more detail. Fits a Product launch goal.`,
    `2. **Myth-busting week** — one misconception per day, carousel format. Fits Education.`,
    `3. **Founder story** — why you started, told in three parts. Fits Awareness.`,
    `4. **Community Q&A** — collect questions, answer one per day. Fits Engagement.`,
    ``,
    `These are AI-generated ideas based on your profile and goals — not real-time trend data.`,
  ].join("\n");
}

function profileHelp(ctx: AssistantContext): string {
  if (ctx.profiles.length === 0) {
    return "You have no brand profiles yet. Create one under Brand Profiles and paste a few sample posts — Draftly detects style characteristics from them, and personalized drafts get much better.";
  }
  const p = ctx.profiles[0];
  return [
    `Your profile “${p.name}” is ready to use.`,
    p.tone ? `Tone: ${p.tone}.` : "",
    p.audience ? `Audience: ${p.audience}.` : "",
    ``,
    `To improve it: add more sample posts (3–5 is ideal) and fill the "words to use" and "words to avoid" fields — every personalized draft picks them up.`,
  ].filter(Boolean).join("\n");
}

function fallback(message: string): string {
  return [
    `I can help with that. In demo mode I answer a few core question types with your real context:`,
    ``,
    `• "What should I post this week?" — weekly plan`,
    `• "What content works for my audience?" — ideas`,
    `• "How do I improve my draft?" — improvements`,
    `• "Suggest campaign ideas" — campaign themes`,
    `• "How is my profile set up?" — profile review`,
    ``,
    `You said: “${message}”. Connect an AI provider key in Settings to get free-form answers on anything.`,
  ].join("\n");
}

/* ---------- router ---------- */

export function assistantReply(message: string, ctx: AssistantContext): AssistantReply {
  const m = message.toLowerCase();

  let text: string;
  let scenarios: string[] = [];

  if (m.includes("week") || m.includes("post this week") || m.includes("schedule")) {
    text = weekPlan(ctx);
    scenarios = ["Ideas for my audience", "Campaign ideas", "Review my profile"];
  } else if (m.includes("audience") || m.includes("ideas") || m.includes("content could appeal")) {
    text = audienceIdeas(ctx);
    scenarios = ["What should I post this week?", "How do I improve my draft?"];
  } else if (m.includes("improve") || m.includes("engaging") || m.includes("better") || m.includes("draft")) {
    text = improveDraft(ctx);
    scenarios = ["What should I post this week?", "Campaign ideas"];
  } else if (m.includes("campaign") || m.includes("launch")) {
    text = campaignIdeas(ctx);
    scenarios = ["What should I post this week?", "Ideas for my audience"];
  } else if (m.includes("profile") || m.includes("brand voice")) {
    text = profileHelp(ctx);
    scenarios = ["What should I post this week?", "Ideas for my audience"];
  } else {
    text = fallback(message);
    scenarios = ["What should I post this week?", "Ideas for my audience", "How do I improve my draft?"];
  }

  return { text, scenarios, source: "demo" };
}
