import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWithAI } from "@/lib/ai";

const schema = z.object({
  idea: z.string().trim().min(3, "Describe your idea first").max(2000),
  profileId: z.string().optional().nullable(),
  audience: z.string().trim().max(500).optional().nullable(),
  platform: z.enum(["Instagram", "LinkedIn", "YouTube", "Facebook", "X"]),
  goal: z.string().trim().min(1).max(100),
  format: z.enum([
    "captions",
    "hooks",
    "hashtags",
    "video_script",
    "carousel",
    "image_concept",
    "headline",
    "cta_only",
    "post",
  ]),
  variant: z.number().int().min(0).max(9).optional(),
  save: z.boolean().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { idea, profileId, audience, platform, goal, format, variant = 0, save } = parsed.data;

  // Profile must belong to the user.
  let profile = null;
  if (profileId) {
    profile = await prisma.brandProfile.findFirst({
      where: { id: profileId, userId: user.id },
    });
  }

  const { draft, mode } = await generateWithAI({
    idea,
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
    audience,
    platform,
    goal,
    format,
    variant,
  });

  let draftId: string | null = null;
  if (save) {
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
        platform,
        goal,
        format,
        audience,
        isPersonalized: Boolean(profile),
        status: "draft",
      },
    });
    draftId = created.id;
  }

  return NextResponse.json({ draft, mode, draftId });
}
