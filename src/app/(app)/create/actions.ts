"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDraft } from "@/lib/generate";

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
  const platform = String(formData.get("platform") ?? "Instagram");
  const goal = String(formData.get("goal") ?? "Awareness");
  const format = String(formData.get("format") ?? "captions");
  const variant = Math.max(0, parseInt(String(formData.get("variant") ?? "0"), 10) || 0);

  return {
    step,
    idea,
    profileId,
    audience: [audienceAge, audienceLocation, audienceInterests]
      .filter(Boolean)
      .join(", "),
    platform,
    goal,
    format,
    variant,
  };
}

function toQuery(s: ReturnType<typeof buildState>, step: number) {
  const q = new URLSearchParams({
    step: String(step),
    idea: s.idea,
    profileId: s.profileId,
    audienceAge: String(formDataGet(s, "audienceAge")),
    audienceLocation: String(formDataGet(s, "audienceLocation")),
    audienceInterests: String(formDataGet(s, "audienceInterests")),
    platform: s.platform,
    goal: s.goal,
    format: s.format,
    variant: String(s.variant),
  });
  return `/create?${q.toString()}`;
}

// helper to re-read raw fields from the form for query building
function formDataGet(s: ReturnType<typeof buildState>, key: string) {
  return (s as unknown as Record<string, string>)[key] ?? "";
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

  const draft = generateDraft({
    idea: s.idea,
    profile: profile
      ? {
          name: profile.name,
          tone: profile.tone,
          language: profile.language,
          wordsToUse: profile.wordsToUse,
          wordsToAvoid: profile.wordsToAvoid,
          audience: profile.audience,
        }
      : null,
    audience: s.audience || null,
    platform: s.platform,
    goal: s.goal,
    format: s.format,
    variant: s.variant,
  });

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
    },
  });

  redirect(`/drafts/${created.id}?notice=${encodeURIComponent("Draft generated (demo mode — templates, not AI)")}`);
}

/** Alternative version of the same draft. */
export async function generateAlternative(formData: FormData) {
  const s = buildState(formData);
  const next = { ...s, variant: s.variant + 1 };
  const q = new URLSearchParams({
    step: "0",
    idea: next.idea,
    profileId: next.profileId,
    audienceAge: String(formDataGet(next, "audienceAge")),
    audienceLocation: String(formDataGet(next, "audienceLocation")),
    audienceInterests: String(formDataGet(next, "audienceInterests")),
    platform: next.platform,
    goal: next.goal,
    format: next.format,
    variant: String(next.variant),
  });
  // Re-run generate with bumped variant by posting to the same action.
  redirect(`/create?${q.toString()}&auto=1`);
}
