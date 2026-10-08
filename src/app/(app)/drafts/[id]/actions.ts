"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transformDraft, type TransformKind } from "@/lib/transforms";
import type { GeneratedDraft } from "@/lib/generate";

/** Load a draft the signed-in user owns, with its versions. */
async function ownedDraft(id: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const draft = await prisma.contentDraft.findFirst({
    where: { id, userId: user.id },
  });
  if (!draft) redirect("/drafts");
  return draft;
}

function toGenerated(draft: {
  title: string;
  hook: string | null;
  body: string | null;
  caption: string | null;
  hashtags: string | null;
  cta: string | null;
  visualNotes: string | null;
  platform: string;
  goal: string | null;
  format: string | null;
  audience: string | null;
}): GeneratedDraft {
  return {
    title: draft.title,
    hook: draft.hook ?? "",
    body: draft.body ?? "",
    caption: draft.caption ?? "",
    hashtags: (draft.hashtags ?? "").split(",").map((h) => h.trim()).filter(Boolean),
    cta: draft.cta ?? "",
    visualDirection: draft.visualNotes ?? "",
    platform: draft.platform,
    goal: draft.goal ?? "",
    format: draft.format ?? "post",
    audience: draft.audience ?? null,
  };
}

async function snapshotVersion(draftId: string, label: string, d: GeneratedDraft) {
  await prisma.draftVersion.create({
    data: {
      draftId,
      label,
      content: JSON.stringify(d),
    },
  });
}

/* ---------- apply a transformation ---------- */

export async function applyTransform(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "regenerate") as TransformKind;

  const draft = await ownedDraft(id);
  const result = transformDraft(kind, toGenerated(draft));

  const d = result.draft;
  await prisma.contentDraft.update({
    where: { id },
    data: {
      title: d.title,
      hook: d.hook,
      body: d.body,
      caption: d.caption,
      hashtags: d.hashtags.join(", "),
      cta: d.cta,
      visualNotes: d.visualDirection,
    },
  });

  await snapshotVersion(id, result.label, d);
  revalidatePath(`/drafts/${id}`);
  redirect(`/drafts/${id}?notice=${encodeURIComponent(result.label + " applied")}`);
}

/* ---------- save user edits ---------- */

const editSchema = z.object({
  hook: z.string().max(2000),
  body: z.string().max(10000),
  cta: z.string().max(1000),
  hashtags: z.string().max(1000),
});

export async function saveEdits(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const draft = await ownedDraft(id);

  const parsed = editSchema.safeParse({
    hook: String(formData.get("hook") ?? ""),
    body: String(formData.get("body") ?? ""),
    cta: String(formData.get("cta") ?? ""),
    hashtags: String(formData.get("hashtags") ?? ""),
  });

  if (!parsed.success) {
    redirect(`/drafts/${id}?notice=${encodeURIComponent("Could not save — check field lengths")}`);
  }

  // Snapshot the pre-edit state so nothing is overwritten silently.
  const before = toGenerated(draft);
  await snapshotVersion(id, "Before manual edit", before);

  const d = parsed.data;
  await prisma.contentDraft.update({
    where: { id },
    data: {
      hook: d.hook,
      body: d.body,
      caption: d.body,
      cta: d.cta,
      hashtags: d.hashtags,
    },
  });

  revalidatePath(`/drafts/${id}`);
  redirect(`/drafts/${id}?notice=${encodeURIComponent("Edits saved (previous version kept in history)")}`);
}

/* ---------- restore a version ---------- */

export async function restoreVersion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  await ownedDraft(id);

  const version = await prisma.draftVersion.findFirst({
    where: { id: versionId, draftId: id },
  });
  if (!version) redirect(`/drafts/${id}`);

  const current = await prisma.contentDraft.findUnique({ where: { id } });
  if (current) {
    await snapshotVersion(id, "Before restore", toGenerated(current));
  }

  const v = JSON.parse(version.content) as GeneratedDraft;
  await prisma.contentDraft.update({
    where: { id },
    data: {
      title: v.title,
      hook: v.hook,
      body: v.body,
      caption: v.caption,
      hashtags: v.hashtags.join(", "),
      cta: v.cta,
      visualNotes: v.visualDirection,
    },
  });

  revalidatePath(`/drafts/${id}`);
  redirect(`/drafts/${id}?notice=${encodeURIComponent(`Restored "${version.label}"`)}`);
}

/* ---------- delete ---------- */

export async function deleteDraft(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await prisma.contentDraft.deleteMany({ where: { id, userId: user.id } });
  redirect("/drafts");
}
