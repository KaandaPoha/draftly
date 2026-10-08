import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeSamples } from "@/lib/style-analysis";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Profile name is required").max(80),
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
  samples: z.array(z.string().max(10000)).max(20).optional(),
});

function list(): { orderBy: { createdAt: "desc" } } {
  return { orderBy: { createdAt: "desc" as const } };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const profiles = await prisma.brandProfile.findMany({
    where: { userId: user.id, isTemporary: false },
    ...list(),
    include: { samplePosts: { select: { id: true, content: true, createdAt: true } } },
  });

  return NextResponse.json({
    profiles: profiles.map((p) => ({
      ...p,
      styleAnalysis: p.styleAnalysis ? JSON.parse(p.styleAnalysis) : null,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { samples, ...data } = parsed.data;

  const profile = await prisma.brandProfile.create({
    data: {
      ...data,
      userId: user.id,
      samplePosts: {
        create: (samples ?? []).filter(Boolean).map((content) => ({ content })),
      },
      // Analysis is heuristic and only meaningful with samples; store it whenever samples exist.
      styleAnalysis:
        samples && samples.filter(Boolean).length > 0
          ? JSON.stringify(analyzeSamples(samples.filter(Boolean)))
          : undefined,
    },
    include: { samplePosts: true },
  });

  return NextResponse.json({
    profile: {
      ...profile,
      styleAnalysis: profile.styleAnalysis ? JSON.parse(profile.styleAnalysis) : null,
    },
  });
}
