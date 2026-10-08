"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const campaignSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required").max(120),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export async function createCampaign(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = campaignSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    startDate: String(formData.get("startDate") ?? "") || null,
    endDate: String(formData.get("endDate") ?? "") || null,
  });

  if (!parsed.success) {
    redirect("/campaigns?error=name");
  }

  const created = await prisma.campaign.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    },
  });

  revalidatePath("/campaigns");
  redirect(`/campaigns/${created.id}`);
}

/** Attach (or detach) a draft to a campaign. */
export async function setDraftCampaign(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const draftId = String(formData.get("draftId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? `/campaigns/${campaignId}`);

  const draft = await prisma.contentDraft.findFirst({
    where: { id: draftId, userId: user.id },
  });
  if (!draft) redirect("/drafts");

  // Empty campaignId = detach.
  let validCampaignId: string | null = null;
  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId: user.id },
    });
    validCampaignId = campaign?.id ?? null;
  }

  await prisma.contentDraft.update({
    where: { id: draftId },
    data: { campaignId: validCampaignId },
  });

  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function deleteCampaign(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id") ?? "");
  await prisma.campaign.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/campaigns");
  redirect("/campaigns");
}
