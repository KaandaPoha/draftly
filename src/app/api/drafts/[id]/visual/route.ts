import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderArtboard, renderReelPreview } from "@/lib/visual";
import type { ArtboardSpec, StoryboardShot } from "@/lib/generate";

/**
 * Serve a draft's generated visual as a real image file.
 *
 *   /api/drafts/[id]/visual?kind=artboard   → the still artboard (SVG)
 *   /api/drafts/[id]/visual?kind=reel       → the animated storyboard (SVG+SMIL)
 *   &download=1                             → force a file download
 *
 * Draft-scoped and ownership-checked; no client JavaScript required.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const draft = await prisma.contentDraft.findFirst({
    where: { id, userId: user.id },
    include: { profile: { select: { name: true } } },
  });
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "reel" ? "reel" : "artboard";
  const download = url.searchParams.get("download") === "1";

  if (!draft.imagePrompt) {
    return NextResponse.json(
      { error: "This draft has no visual spec. Regenerate it to create one." },
      { status: 404 }
    );
  }

  let artboard: ArtboardSpec;
  try {
    artboard = JSON.parse(draft.imagePrompt) as ArtboardSpec;
  } catch {
    return NextResponse.json({ error: "Visual spec is unreadable" }, { status: 500 });
  }

  const brandName = draft.profile?.name ?? "Draftly";

  let svg: string;
  if (kind === "reel") {
    let shots: StoryboardShot[] = [];
    try {
      shots = draft.storyboard ? (JSON.parse(draft.storyboard) as StoryboardShot[]) : [];
    } catch {
      shots = [];
    }
    if (!shots.length) {
      return NextResponse.json(
        { error: "This draft has no storyboard to animate. Generate a reel or video format." },
        { status: 404 }
      );
    }
    svg = renderReelPreview(shots, artboard, brandName);
  } else {
    svg = renderArtboard(artboard, brandName);
  }

  const filename = `${slug(draft.title)}-${kind}.svg`;

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "private, max-age=0, must-revalidate",
      ...(download
        ? { "content-disposition": `attachment; filename="${filename}"` }
        : {}),
    },
  });
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "draftly";
}