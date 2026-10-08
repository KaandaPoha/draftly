"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  draftId: z.string().min(1, "Pick a draft"),
  platform: z.string().min(1),
  scheduledFor: z.string().min(1, "Pick a date and time"),
});

/** Schedule a draft onto the calendar. Status becomes "scheduled". */
export async function scheduleDraft(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = createSchema.safeParse({
    draftId: String(formData.get("draftId") ?? ""),
    platform: String(formData.get("platform") ?? ""),
    scheduledFor: String(formData.get("scheduledFor") ?? ""),
  });

  if (!parsed.success) {
    redirect(`/planner?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }

  const draft = await prisma.contentDraft.findFirst({
    where: { id: parsed.data.draftId, userId: user.id },
  });
  if (!draft) redirect("/planner?error=draft");

  await prisma.calendarEntry.create({
    data: {
      userId: user.id,
      draftId: draft.id,
      platform: parsed.data.platform,
      scheduledFor: new Date(parsed.data.scheduledFor),
      status: "scheduled",
    },
  });

  // Keep the draft status in sync.
  await prisma.contentDraft.update({
    where: { id: draft.id },
    data: { status: "scheduled" },
  });

  revalidatePath("/planner");
  redirect("/planner?notice=" + encodeURIComponent("Draft scheduled — status updated everywhere"));
}

/** Move an entry back to draft (un-schedule). */
export async function unschedule(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = String(formData.get("entryId") ?? "");
  const entry = await prisma.calendarEntry.findFirst({
    where: { id, userId: user.id },
  });
  if (!entry) redirect("/planner");

  await prisma.calendarEntry.delete({ where: { id: entry.id } });

  if (entry.draftId) {
    await prisma.contentDraft.updateMany({
      where: { id: entry.draftId, status: "scheduled" },
      data: { status: "draft" },
    });
  }

  revalidatePath("/planner");
  redirect("/planner?notice=" + encodeURIComponent("Removed from calendar"));
}

/** Mark a past entry as published — only a real user action, never automatic. */
export async function markPublished(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = String(formData.get("entryId") ?? "");
  const entry = await prisma.calendarEntry.findFirst({
    where: { id, userId: user.id },
  });
  if (!entry) redirect("/planner");

  // Honest flow: this records that YOU published it on the platform manually.
  await prisma.calendarEntry.update({
    where: { id: entry.id },
    data: { status: "published" },
  });

  if (entry.draftId) {
    await prisma.contentDraft.update({
      where: { id: entry.draftId },
      data: { status: "published" },
    });
  }

  revalidatePath("/planner");
  redirect("/planner?notice=" + encodeURIComponent("Marked as published — only do this after actually posting"));
}
