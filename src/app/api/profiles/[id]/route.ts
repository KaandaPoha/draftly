import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeSamples } from "@/lib/style-analysis";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  niche: z.string().trim().max(200).optional().nullable(),
  offerings: z.string().trim().max(1000).optional().nullable(),
  audience: z.string().trim().max(1000).optional().nullable(),
  platforms: z.string().trim().max(200).optional().nullable(),
  language: z.string().trim().max(50).optional().nullable(),
  tone: z.string().trim().max(200).optional().nullable(),
  wordsToUse: z.string().trim().max(500).optional().nullable(),
  wordsToAvoid: z.string().trim().max(500).optional().nullable(),
  guidelines: z.string().trim().max(3000).optional().nullable(),
  colors: z.string().trim().max(200).optional().nullable(),
  newSamples: z.array(z.string().max(10000)).max(20).optional(),
  reanalyze: z.boolean().optional(),
});

async function ownedProfile(userId: string, id: string) {
  return prisma.brandProfile.findFirst({
    where: { id, userId, isTemporary: false },
    include: { samplePosts: true },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const existing = await ownedProfile(user.id, id);
  if (!existing) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { newSamples, reanalyze, ...fields } = parsed.data;

  if (newSamples?.length) {
    await prisma.samplePost.createMany({
      data: newSamples.filter(Boolean).map((content) => ({ profileId: id, content })),
    });
  }

  // Re-run the heuristic analysis when requested or when samples changed.
  let styleAnalysis: string | undefined;
  const shouldAnalyze =
    reanalyze || (newSamples?.filter(Boolean).length ?? 0) > 0;
  if (shouldAnalyze) {
    const allContents = await prisma.samplePost.findMany({
      where: { profileId: id },
      select: { content: true },
    });
    styleAnalysis = JSON.stringify(analyzeSamples(allContents.map((s) => s.content)));
  }

  const profile = await prisma.brandProfile.update({
    where: { id },
    data: { ...fields, ...(styleAnalysis ? { styleAnalysis } : {}) },
    include: { samplePosts: true },
  });

  return NextResponse.json({
    profile: {
      ...profile,
      styleAnalysis: profile.styleAnalysis ? JSON.parse(profile.styleAnalysis) : null,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const existing = await ownedProfile(user.id, id);
  if (!existing) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  await prisma.brandProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
