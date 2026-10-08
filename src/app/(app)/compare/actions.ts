"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDraft } from "@/lib/generate";

/**
 * Compare page action: generates BOTH drafts server-side and saves them,
 * then redirects to the compare result page. No client JS involved.
 */
export async function compareAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const idea = String(formData.get("idea") ?? "").trim();
  const platform = String(formData.get("platform") ?? "Instagram");
  const goal = String(formData.get("goal") ?? "Awareness");
  const format = String(formData.get("format") ?? "post");
  const audience = String(formData.get("audience") ?? "").trim() || null;
  const profileId = String(formData.get("profileId") ?? "") || null;

  if (idea.length < 3) {
    redirect("/compare?error=idea");
  }

  const profile = profileId
    ? await prisma.brandProfile.findFirst({
        where: { id: profileId, userId: user.id },
      })
    : null;

  const base = {
    idea,
    audience,
    platform,
    goal,
    format,
  };

  // A — generic: no profile context at all.
  const generic = generateDraft({ ...base, profile: null, variant: 0 });

  // B — personalized: full profile context.
  const personalized = generateDraft({
    ...base,
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
    variant: 0,
  });

  // Save both as drafts so the comparison is inspectable later.
  const genericCreated = await prisma.contentDraft.create({
    data: toDb(user.id, null, generic, { idea, platform, goal, format, audience }),
  });
  const personalizedCreated = await prisma.contentDraft.create({
    data: toDb(user.id, profile?.id ?? null, personalized, { idea, platform, goal, format, audience }, true),
  });

  redirect(
    `/compare/${genericCreated.id}/${personalizedCreated.id}`
  );
}

function toDb(
  userId: string,
  profileId: string | null,
  d: ReturnType<typeof generateDraft>,
  meta: { idea: string; platform: string; goal: string; format: string; audience: string | null },
  personalized = false
) {
  return {
    userId,
    profileId,
    title: d.title,
    hook: d.hook,
    body: d.body,
    caption: d.caption,
    hashtags: d.hashtags.join(", "),
    cta: d.cta,
    visualNotes: d.visualDirection,
    platform: meta.platform,
    goal: meta.goal,
    format: meta.format,
    audience: meta.audience,
    idea: meta.idea,
    variant: 0,
    isPersonalized: personalized,
  };
}
