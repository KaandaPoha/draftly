// Per-request rendering (cookies + DB).
export const instant = false;

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MonitorSmartphone } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/ui";

/**
 * Publishing preview — renders the draft as it would appear on each platform.
 * This is a PREVIEW/export flow: no posting happens, no platform APIs are
 * connected, and nothing is presented as published. Copy is manual.
 */

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const id = String(sp.draft ?? "");

  const draft = await prisma.contentDraft.findFirst({
    where: { id, userId: user.id },
    include: { profile: { select: { name: true } } },
  });
  if (!draft) notFound();

  const hashtags = (draft.hashtags ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  return (
    <>
      <PageHeader
        title="Publishing preview"
        subtitle={`How “${draft.title}” would look on each platform — preview only, nothing is posted.`}
      />

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8 md:px-10">
        <Link href={`/drafts/${draft.id}`} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
          <ArrowLeft size={15} aria-hidden /> Back to draft
        </Link>

        <Card className="flex gap-3 border-warning/30 bg-warning/5">
          <MonitorSmartphone size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm leading-relaxed text-text-muted">
            <strong className="text-text">Preview &amp; export mode.</strong>{" "}
            Direct publishing to Instagram/LinkedIn/Facebook/X requires official
            platform APIs and account permissions Draftly doesn&rsquo;t have yet.
            To publish today: copy the text below and post it manually, or use
            the platform&rsquo;s own scheduler.
          </p>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <PreviewCard
            platform="Instagram"
            title={draft.hook ?? ""}
            body={[draft.caption ?? draft.body ?? "", hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")]
              .filter(Boolean)
              .join("\n\n")}
            cta={draft.cta ?? ""}
          />
          <PreviewCard
            platform="LinkedIn"
            title={draft.hook ?? ""}
            body={draft.body ?? ""}
            cta={draft.cta ?? ""}
          />
          <PreviewCard
            platform="X"
            title={draft.hook ?? ""}
            body={(draft.body ?? "").split("\n\n")[0] ?? ""}
            cta=""
          />
          <PreviewCard
            platform="Facebook"
            title={draft.hook ?? ""}
            body={[draft.body ?? "", draft.cta ?? ""].filter(Boolean).join("\n\n")}
            cta=""
          />
        </div>
      </div>
    </>
  );
}

function PreviewCard({
  platform,
  title,
  body,
  cta,
}: {
  platform: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold">{platform}</h2>
        <Badge>{platform === "X" ? "280 chars max" : platform === "Instagram" ? "Reels/Feed" : "Feed post"}</Badge>
      </div>

      {/* Mocked render, styled like the platform surface */}
      <div className="rounded-lg border border-line bg-surface-2 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 font-display text-xs font-semibold text-accent">
            {platform.slice(0, 2)}
          </span>
          <span className="text-xs text-text-faint">Your account · just now</span>
        </div>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">
          {title && <strong className="mb-2 block">{title}</strong>}
          {body}
        </p>
        {cta && (
          <p className="mt-3 border-t border-line pt-3 text-sm font-medium text-accent">
            {cta}
          </p>
        )}
      </div>

      {/* Selectable text for manual copy (readOnly — no JS handlers) */}
      <textarea
        readOnly
        value={[title, body, cta].filter(Boolean).join("\n\n")}
        rows={6}
        aria-label={`Copyable text for ${platform}`}
        className="h-28 rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs outline-none focus:border-accent"
      />
      <p className="text-xs text-text-faint">
        Select all the text above and press Ctrl+C to copy — this is the
        manual, honest path while publishing APIs aren&rsquo;t connected.
      </p>
    </Card>
  );
}
