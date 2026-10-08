import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { draftToExport, type ExportFormat } from "@/lib/export";

/**
 * GET export — a real file download that works from a plain link,
 * no client JavaScript required.
 * /api/drafts/[id]/export?format=markdown|json|text
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const format = (new URL(request.url).searchParams.get("format") || "markdown") as ExportFormat;

  const draft = await prisma.contentDraft.findFirst({
    where: { id, userId: user.id },
    include: { profile: { select: { name: true } } },
  });
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const content = draftToExport(draft, format, draft.profile?.name);
  const ext = format === "json" ? "json" : format === "markdown" ? "md" : "txt";
  const safeTitle =
    draft.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase().slice(0, 60) ||
    "draft";

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="draftly-${safeTitle}.${ext}"`,
    },
  });
}
