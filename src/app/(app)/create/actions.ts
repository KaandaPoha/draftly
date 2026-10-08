"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateContent } from "@/lib/ai";
import { submitToken, once } from "@/lib/submit-guard";

/**
 * Create Studio without JavaScript.
 * The whole 6-step wizard lives in query params; every step is a plain form.
 * state is { step, idea, profileId, audience, platform, goal, format, variant }.
 */

function buildState(formData: FormData) {
  const step = Math.max(0, parseInt(String(formData.get("step") ?? "0"), 10) || 0);
  const idea = String(formData.get("idea") ?? "").slice(0, 2000);
  const profileId = String(formData.get("profileId") ?? "");
  const audienceAge = String(formData.get("audienceAge") ?? "").slice(0, 100);
  const audienceLocation = String(formData.get("audienceLocation") ?? "").slice(0, 100);
  const audienceInterests = String(formData.get("audienceInterests") ?? "").slice(0, 200);
  const audienceInterestsOther = String(formData.get("audienceInterestsOther") ?? "").slice(0, 200);
  const platform = String(formData.get("platform") ?? "Instagram");
  const goal = String(formData.get("goal") ?? "Awareness");
  const format = String(formData.get("format") ?? "captions");
  const variant = Math.max(0, parseInt(String(formData.get("variant") ?? "0"), 10) || 0);

  return {
    step,
    idea,
    profileId,
    audienceAge,
    audienceLocation,
    audienceInterests,
    audienceInterestsOther,
    audience: [audienceAge, audienceLocation, audienceInterests, audienceInterestsOther]
      .filter(Boolean)
      .join(", "),
    platform,
    goal,
    format,
    variant,
  };
}

/**
 * Rebuild the wizard query string from the parsed form state.
 *
 * The audience fields are carried forward individually, not as the joined
 * `audience` string, so the Audience step can round-trip what the user typed
 * and so edits made there actually take effect.
 */
function toQuery(s: ReturnType<typeof buildState>, step: number) {
  const q = new URLSearchParams({
    step: String(step),
    idea: s.idea,
    profileId: s.profileId,
    audienceAge: s.audienceAge,
    audienceLocation: s.audienceLocation,
    audienceInterests: s.audienceInterests,
    audienceInterestsOther: s.audienceInterestsOther,
    platform: s.platform,
    goal: s.goal,
    format: s.format,
    variant: String(s.variant),
  });
  return `/create?${q.toString()}`;
}

/** Advance to the next step, carrying state. */
export async function advance(formData: FormData) {
  const s = buildState(formData);

  if (s.step === 0 && s.idea.trim().length < 3) {
    redirect(`/create?step=0&error=idea`);
  }

  redirect(toQuery(s, Math.min(5, s.step + 1)));
}

/** Go back a step. */
export async function back(formData: FormData) {
  const s = buildState(formData);
  redirect(toQuery(s, Math.max(0, s.step - 1)));
}

/** Pick a platform/goal/format chip (server-rendered radios) then advance. */
export async function generate(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const s = buildState(formData);
  if (s.idea.trim().length < 3) {
    redirect(`/create?step=0&error=idea`);
  }

  const profile = s.profileId
    ? await prisma.brandProfile.findFirst({
        where: { id: s.profileId, userId: user.id },
      })
    : null;

  // A rapid double click must not generate and save twice.
  const token = submitToken("create-generate", `${user.id}|${s.idea}|${s.platform}|${s.format}|${s.variant}`);
  if (!once(token)) {
    redirect(`/create?${new URLSearchParams({
      step: "5",
      idea: s.idea,
      platform: s.platform,
      goal: s.goal,
      format: s.format,
      variant: String(s.variant),
      error: "duplicate",
    })}`);
  }

  const result = await generateContent({
    idea: s.idea,
    profile: profile
      ? {
          name: profile.name,
          tone: profile.tone,
          language: profile.language,
          wordsToUse: profile.wordsToUse,
          wordsToAvoid: profile.wordsToAvoid,
          audience: profile.audience,
          niche: profile.niche,
          offerings: profile.offerings,
          colors: profile.colors,
          guidelines: profile.guidelines,
          description: profile.description,
          styleAnalysis: profile.styleAnalysis,
        }
      : null,
    audience: s.audience || null,
    platform: s.platform,
    goal: s.goal,
    format: s.format,
    variant: s.variant,
  });

  const draft = result.draft;

  const created = await prisma.contentDraft.create({
    data: {
      userId: user.id,
      profileId: profile?.id ?? null,
      title: draft.title,
      hook: draft.hook,
      body: draft.body,
      caption: draft.caption,
      hashtags: draft.hashtags.join(", "),
      cta: draft.cta,
      visualNotes: draft.visualDirection,
      platform: s.platform,
      goal: s.goal,
      format: s.format,
      audience: s.audience || null,
      idea: s.idea,
      variant: s.variant,
      isPersonalized: Boolean(profile),
      status: "draft",
      generationMode: result.mode,
      model: result.model,
      storyboard: JSON.stringify(draft.storyboard),
      imagePrompt: JSON.stringify(draft.artboard),
      designSpec: JSON.stringify(draft.design),
    },
  });

  const notice = result.mode === "llm"
    ? `Draft generated with ${result.model}`
    : result.notice ?? "Draft generated (built-in generator)";
  const params = new URLSearchParams({ notice });
  if (result.mode !== "llm") params.set("reason", "fallback");
  redirect(`/drafts/${created.id}?${params.toString()}`);
}

/** Alternative version of the same draft. */
export async function generateAlternative(formData: FormData) {
  const s = buildState(formData);
  const next = { ...s, variant: s.variant + 1 };
  // Re-run generate with the bumped variant by posting to the same action.
  redirect(`${toQuery(next, 5)}&auto=1`);
}
