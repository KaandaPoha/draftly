"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Acknowledge the safety review (explicit user action). */
export async function acknowledgeReview(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  const draft = await prisma.contentDraft.findFirst({
    where: { id, userId: user.id },
  });
  if (!draft) redirect("/drafts");

  const stamp = `[SAFETY REVIEWED ${new Date().toISOString().slice(0, 10)}]`;
  await prisma.contentDraft.update({
    where: { id },
    data: {
      visualNotes: `${stamp} ${(draft.visualNotes ?? "").replace(/^\[SAFETY REVIEWED [^\]]+\]\s*/i, "")}`,
    },
  });

  revalidatePath(`/drafts/${id}`);
  redirect(`/drafts/${id}?notice=${encodeURIComponent("Safety review acknowledged — noted in visual notes")}`);
}
