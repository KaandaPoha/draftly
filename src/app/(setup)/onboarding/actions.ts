"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Onboarding without JavaScript.
 * Each step is a plain HTML form; state travels in the URL. Chips are
 * native checkboxes / submit buttons, so selection works even if client
 * JS fails to load — matching the hydration-proof auth flow.
 */

const ROLES = [
  "Influencer / Creator",
  "Brand / Business",
  "Startup",
  "Small Business",
  "Personal Brand",
  "Individual / Student",
  "Other",
];

export async function selectRole(formData: FormData) {
  const role = String(formData.get("role") ?? "");
  if (!ROLES.includes(role)) {
    redirect("/onboarding?step=0");
  }
  redirect(
    `/onboarding?step=1&role=${encodeURIComponent(role)}`
  );
}

export async function selectGoals(formData: FormData) {
  const role = String(formData.get("role") ?? "");
  const goals = formData.getAll("goals").map(String).filter(Boolean);
  if (goals.length === 0) {
    redirect(`/onboarding?step=1&role=${encodeURIComponent(role)}&error=goals`);
  }
  redirect(
    `/onboarding?step=2&role=${encodeURIComponent(role)}&goals=${encodeURIComponent(goals.join(","))}`
  );
}

export async function selectPlatforms(formData: FormData) {
  const role = String(formData.get("role") ?? "");
  const goals = String(formData.get("goals") ?? "");
  const platforms = formData.getAll("platforms").map(String).filter(Boolean);
  if (platforms.length === 0) {
    redirect(
      `/onboarding?step=2&role=${encodeURIComponent(role)}&goals=${encodeURIComponent(goals)}&error=platforms`
    );
  }
  redirect(
    `/onboarding?step=3&role=${encodeURIComponent(role)}&goals=${encodeURIComponent(goals)}&platforms=${encodeURIComponent(platforms.join(","))}`
  );
}

const saveSchema = z.object({
  role: z.string().min(1),
  goals: z.string().min(1),
  platforms: z.string().min(1),
  language: z.string().min(1),
  tone: z.string().min(1),
});

export async function savePreferences(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = saveSchema.safeParse({
    role: String(formData.get("role") ?? ""),
    goals: String(formData.get("goals") ?? ""),
    platforms: String(formData.get("platforms") ?? ""),
    language: String(formData.get("language") ?? ""),
    tone: String(formData.get("tone") ?? ""),
  });

  if (!parsed.success) {
    // Missing something — send back to the last step to complete it.
    const role = String(formData.get("role") ?? "");
    const goals = String(formData.get("goals") ?? "");
    const platforms = String(formData.get("platforms") ?? "");
    redirect(
      `/onboarding?step=3&role=${encodeURIComponent(role)}&goals=${encodeURIComponent(goals)}&platforms=${encodeURIComponent(platforms)}&error=finish`
    );
  }

  const data = {
    role: parsed.data.role,
    goals: parsed.data.goals,
    platforms: parsed.data.platforms,
    language: parsed.data.language,
    tone: parsed.data.tone,
  };

  await prisma.userPreferences.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });

  redirect("/");
}
