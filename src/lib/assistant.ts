/**
 * Assistant engine — profile-aware responses.
 *
 * Real LLM when a provider is configured, deterministic scenario templates
 * otherwise. The reply always carries its source so the UI can label it, and
 * a failed provider call reports why it fell back.
 */

import type { UserPreferences, BrandProfile } from "@prisma/client";
import { complete, providerConfig, LlmError } from "./llm";

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
  /** When source is "demo" because a configured provider failed, why. */
  notice?: string | null;
};

/* ---------- shared context block ---------- */

export function buildChatPrompt(message: string, ctx: AssistantContext): string {
  const lines: string[] = [];
  if (ctx.userName) lines.push(`The user's name is ${ctx.userName}.`);
  if (ctx.preferences) {
    lines.push(
      `They are a ${ctx.preferences.role ?? "creator"} whose goals are: ${ctx.preferences.goals ?? "not set"}.`
    );
    lines.push(
      `Active platforms: ${ctx.preferences.platforms ?? "not set"}. Preferred tone: ${ctx.preferences.tone ?? "not set"}.`
    );
  }
  if (ctx.profiles.length > 0) {
    lines.push("Their brand profiles:");
    ctx.profiles.forEach((p) => {
      lines.push(
        `- ${p.name}${p.niche ? ` (${p.niche})` : ""}${p.tone ? `, tone: ${p.tone}` : ""}${
          p.audience ? `, audience: ${p.audience}` : ""
        }${p.wordsToUse ? `, words to use: ${p.wordsToUse}` : ""}`
      );
    });
  }
  if (ctx.recentDrafts.length > 0) {
    lines.push("Their recent drafts:");
    ctx.recentDrafts.slice(0, 6).forEach((d) => {
      lines.push(`- ${d.title} (${d.platform}${d.goal ? `, goal: ${d.goal}` : ""})`);
    });
  }
  lines.push(``);
  lines.push(`User asks: ${message}`);
  return lines.join("\n");
}

const ASSISTANT_SYSTEM = `You are Draftly's content strategist: a direct, practical social media advisor.

Use the user's real context (their role, goals, platforms, tone, brand profiles and recent drafts) in your answer. Reference their actual profile and niche — never give generic advice that could apply to anyone.

Rules:
- Be concise. Use short paragraphs and tight bullets.
- Give specific, actionable content ideas: formats, hooks, and angles.
- Never invent statistics, benchmarks, or engagement numbers.
- Any posting-time advice must be labelled as an estimate, since you have no access to their analytics.
- Never claim to see live trends or real-time data — you cannot.
- If you suggest an idea they could turn into content, end with: "Ask \"create this idea\" to load it into the studio."`;

/* ---------- real LLM path ---------- */

export async function assistantReply(
  message: string,
  ctx: AssistantContext
): Promise<AssistantReply> {
  const cfg = providerConfig();

  if (cfg) {
    try {
      const text = await complete(ASSISTANT_SYSTEM, buildChatPrompt(message, ctx), {
        maxTokens: 1200,
      });
      return { text, scenarios: followUps(), source: "ai" };
    } catch (err) {
      const notice =
        err instanceof LlmError
          ? err.friendly
          : "The AI provider call failed, so Draftly answered from its built-in scenarios.";
      return { text: demoReply(message, ctx), scenarios: followUps(), source: "demo", notice };
    }
  }

  return {
    text: demoReply(message, ctx),
    scenarios: followUps(),
    source: "demo",
    notice: "No AI provider is configured — this is a built-in scenario answer.",
  };
}

function followUps(): string[] {
  return [
    "What should I post this week?",
    "Ideas for my audience",
    "How do I improve my draft?",
    "Campaign ideas",
  ];
}

/* ---------- built-in scenarios ---------- */

function weekPlan(ctx: AssistantContext): string {
  const platform =
    (ctx.preferences?.platforms ?? "Instagram,LinkedIn").split(",")[0]?.trim() || "Instagram";
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
    `Ask "create this idea" on any of these and the studio will set itself up.`,
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
    `Open the draft and use the improvement actions — "Shorter", "More professional", "Improve the CTA" — each keeps the previous version in history.`,
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
  ]
    .filter(Boolean)
    .join("\n");
}

function fallback(message: string): string {
  return [
    `Here's what I can help with right now using your real saved context:`,
    ``,
    `• "What should I post this week?" — weekly plan`,
    `• "What content works for my audience?" — ideas`,
    `• "How do I improve my draft?" — improvements`,
    `• "Suggest campaign ideas" — campaign themes`,
    `• "How is my profile set up?" — profile review`,
    ``,
    `You said: “${message}”. Add an AI provider key in Settings for free-form answers on anything.`,
  ].join("\n");
}

function demoReply(message: string, ctx: AssistantContext): string {
  const m = message.toLowerCase();

  if (m.includes("week") || m.includes("post this week") || m.includes("schedule")) {
    return weekPlan(ctx);
  }
  if (m.includes("audience") || m.includes("ideas") || m.includes("content could appeal")) {
    return audienceIdeas(ctx);
  }
  if (m.includes("improve") || m.includes("engaging") || m.includes("better") || m.includes("draft")) {
    return improveDraft(ctx);
  }
  if (m.includes("campaign") || m.includes("launch")) {
    return campaignIdeas(ctx);
  }
  if (m.includes("profile") || m.includes("brand voice")) {
    return profileHelp(ctx);
  }
  return fallback(message);
}