"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeSamples } from "@/lib/style-analysis";

/**
 * Server actions for brand/creator profiles — fully no-JS: every form posts
 * to a server action and redirects back. Same pattern as campaigns.
 */

const profileSchema = z.object({
  name: z.string().trim().min(1, "Profile name is required").max(80),
  description: z.string().trim().max(2000),
  niche: z.string().trim().max(200),
  offerings: z.string().trim().max(1000),
  audience: z.string().trim().max(1000),
  platforms: z.string().trim().max(200),
  language: z.string().trim().max(50),
  tone: z.string().trim().max(200),
  wordsToUse: z.string().trim().max(500),
  wordsToAvoid: z.string().trim().max(500),
  guidelines: z.string().trim().max(3000),
  colors: z.string().trim().max(200),
  samples: z.string().max(50000), // sample posts separated by ---
});

/** Parse the shared samples textarea into individual posts. */
function parseSamples(raw: string): string[] {
  return raw
    // Split on a "---" separator standing alone (on its own line, or
    // surrounded by whitespace) — forgiving for beginners.
    .split(/\s*---\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20); // matches the API's max of 20 samples
}

async function checkedUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

function fieldStrings(formData: FormData) {
  const f = (key: string) => String(formData.get(key) ?? "").trim();
  return {
    name: f("name"),
    description: f("description"),
    niche: f("niche"),
    offerings: f("offerings"),
    audience: f("audience"),
    platforms: f("platforms"),
    language: f("language"),
    tone: f("tone"),
    wordsToUse: f("wordsToUse"),
    wordsToAvoid: f("wordsToAvoid"),
    guidelines: f("guidelines"),
    colors: f("colors"),
    samples: String(formData.get("samples") ?? "").trim(),
  };
}

export type ProfileFormError = { field: string; message: string };

/** Create a profile. Errors go back to the form via query params (no JS). */
export async function createProfile(formData: FormData) {
  const user = await checkedUser();
  const back = "/profiles/new";

  const fields = fieldStrings(formData);
  const parsed = profileSchema.safeParse(fields);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    redirect(`${back}?error=${encodeURIComponent(issue?.message ?? "Invalid input")}&field=${String(issue?.path[0] ?? "")}`);
  }

  const samples = parseSamples(fields.samples);
  const data = parsed.data;

  const profile = await prisma.brandProfile.create({
    data: {
      name: data.name,
      description: data.description || null,
      niche: data.niche || null,
      offerings: data.offerings || null,
      audience: data.audience || null,
      platforms: data.platforms || null,
      language: data.language || null,
      tone: data.tone || null,
      wordsToUse: data.wordsToUse || null,
      wordsToAvoid: data.wordsToAvoid || null,
      guidelines: data.guidelines || null,
      colors: data.colors || null,
      userId: user.id,
      samplePosts: {
        create: samples.map((content) => ({ content })),
      },
      // Heuristic analysis only makes sense when there are samples.
      styleAnalysis: samples.length
        ? JSON.stringify(analyzeSamples(samples))
        : undefined,
    },
  });

  revalidatePath("/profiles");
  redirect(`/profiles/${profile.id}`);
}

/** Update an existing profile. Adding samples re-runs the style analysis. */
export async function updateProfile(formData: FormData) {
  const user = await checkedUser();
  const id = String(formData.get("id") ?? "");
  const back = `/profiles/${id}/edit`;

  const profile = await prisma.brandProfile.findFirst({
    where: { id, userId: user.id, isTemporary: false },
  });
  if (!profile) redirect("/profiles");

  const fields = fieldStrings(formData);
  const parsed = profileSchema.safeParse(fields);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    redirect(`${back}?error=${encodeURIComponent(issue?.message ?? "Invalid input")}&field=${String(issue?.path[0] ?? "")}`);
  }

  const newSamples = parseSamples(fields.samples);
  const data = parsed.data;

  if (newSamples.length) {
    await prisma.samplePost.createMany({
      data: newSamples.map((content) => ({ profileId: id, content })),
    });
  }

  // Re-analyze when samples were added. Existing manual overrides are
  // preserved so the analysis never silently discards a user's edit.
  let styleAnalysis: string | undefined;
  if (newSamples.length) {
    const all = await prisma.samplePost.findMany({
      where: { profileId: id },
      select: { content: true },
    });
    styleAnalysis = mergeAnalysisWithOverrides(
      profile.styleAnalysis,
      analyzeSamples(all.map((s) => s.content))
    );
  }

  await prisma.brandProfile.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      niche: data.niche || null,
      offerings: data.offerings || null,
      audience: data.audience || null,
      platforms: data.platforms || null,
      language: data.language || null,
      tone: data.tone || null,
      wordsToUse: data.wordsToUse || null,
      wordsToAvoid: data.wordsToAvoid || null,
      guidelines: data.guidelines || null,
      colors: data.colors || null,
      ...(styleAnalysis ? { styleAnalysis } : {}),
    },
  });

  revalidatePath(`/profiles/${id}`);
  redirect(`/profiles/${id}`);
}

/**
 * Re-run the heuristic analysis while keeping any manual overrides the user
 * has already applied. Overrides live under an "overrides" key, so a fresh
 * analysis would otherwise erase them — that would be a silent data loss.
 */
function mergeAnalysisWithOverrides(
  previous: string | null,
  fresh: unknown
): string {
  let overrides: Record<string, string> = {};
  if (previous) {
    try {
      const parsed = JSON.parse(previous) as { overrides?: Record<string, string> };
      overrides = parsed.overrides ?? {};
    } catch {
      // A corrupt blob should not block the update — start clean.
    }
  }
  const merged = { ...(fresh as Record<string, unknown>) };
  if (Object.keys(overrides).length) merged.overrides = overrides;
  return JSON.stringify(merged);
}

/** Explicit "re-run style analysis" button on the detail page. */
export async function reanalyzeProfile(formData: FormData) {
  const user = await checkedUser();
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("returnTo") ?? `/profiles/${id}`);

  const profile = await prisma.brandProfile.findFirst({
    where: { id, userId: user.id, isTemporary: false },
  });
  if (!profile) redirect("/profiles");

  const all = await prisma.samplePost.findMany({
    where: { profileId: id },
    select: { content: true },
  });

  await prisma.brandProfile.update({
    where: { id },
    data: {
      styleAnalysis: all.length
        ? mergeAnalysisWithOverrides(
            profile.styleAnalysis,
            analyzeSamples(all.map((s) => s.content))
          )
        : null,
    },
  });

  revalidatePath(back);
  redirect(back);
}

export async function deleteProfile(formData: FormData) {
  const user = await checkedUser();
  const id = String(formData.get("id") ?? "");
  await prisma.brandProfile.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/profiles");
  redirect("/profiles");
}

/**
 * Toggle a style-characteristic override. Each trait row on the detail page
 * posts here with the new value (or empty = clear the override, falling back
 * to the inferred value). Overrides live under an "overrides" key inside the
 * stored styleAnalysis JSON so the inferred analysis itself is never mutated.
 */
export async function setStyleOverride(formData: FormData) {
  const user = await checkedUser();
  const id = String(formData.get("id") ?? "");
  const key = String(formData.get("key") ?? "");
  const value = String(formData.get("value") ?? "").trim();
  const back = String(formData.get("returnTo") ?? `/profiles/${id}`);

  const allowed = new Set([
    "formality", "humor", "sentenceLength", "emojiUsage", "vocabulary",
    "promotionalIntensity", "storytelling",
  ]);
  if (!allowed.has(key)) redirect(back);

  const profile = await prisma.brandProfile.findFirst({
    where: { id, userId: user.id, isTemporary: false },
  });
  if (!profile) redirect("/profiles");

  type Stored = Record<string, unknown> & { overrides?: Record<string, string> };
  const stored: Stored = profile.styleAnalysis
    ? JSON.parse(profile.styleAnalysis)
    : {};
  const overrides: Record<string, string> = { ...(stored.overrides ?? {}) };

  if (value) overrides[key] = value;
  else delete overrides[key];

  if (Object.keys(overrides).length === 0) delete stored.overrides;
  else stored.overrides = overrides;

  await prisma.brandProfile.update({
    where: { id },
    data: { styleAnalysis: JSON.stringify(stored) },
  });

  revalidatePath(back);
  redirect(back);
}
