import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { setDraftCampaign } from "../actions";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: user.id },
    include: {
      drafts: {
        orderBy: { createdAt: "desc" },
        include: { profile: { select: { name: true } } },
      },
    },
  });
  if (!campaign) notFound();

  // Drafts not yet in this campaign — candidates to attach.
  const available = await prisma.contentDraft.findMany({
    where: { userId: user.id, campaignId: null },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <>
      <PageHeader
        title={campaign.name}
        subtitle={`${campaign.drafts.length} draft${campaign.drafts.length === 1 ? "" : "s"}${campaign.startDate ? ` · ${campaign.startDate.toLocaleDateString()}` : ""}${campaign.endDate ? ` → ${campaign.endDate.toLocaleDateString()}` : ""}`}
      />

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8 md:px-10">
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
          <ArrowLeft size={15} aria-hidden /> All campaigns
        </Link>

        {/* Drafts in campaign */}
        {campaign.drafts.length === 0 ? (
          <EmptyState
            title="No drafts attached"
            description="Attach drafts from your library below — they'll show up here with their statuses."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {campaign.drafts.map((d) => (
              <Card key={d.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/drafts/${d.id}`} className="font-medium hover:text-accent">
                    {d.title}
                  </Link>
                  <Badge tone={d.status === "published" ? "success" : d.status === "scheduled" ? "accent" : "neutral"}>
                    {d.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-faint">
                  <Badge>{d.platform}</Badge>
                  {d.profile && <Badge>{d.profile.name}</Badge>}
                  <form action={setDraftCampaign} className="ml-auto">
                    <input type="hidden" name="draftId" value={d.id} />
                    <input type="hidden" name="campaignId" value="" />
                    <input type="hidden" name="returnTo" value={`/campaigns/${campaign.id}`} />
                    <button type="submit" className="text-xs text-danger hover:underline">
                      Detach
                    </button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Attach drafts */}
        {available.length > 0 && (
          <Card className="flex flex-col gap-3">
            <h2 className="font-display font-semibold">Attach drafts</h2>
            <p className="text-sm text-text-muted">Pick drafts from your library to add to this campaign.</p>
            <div className="flex flex-col gap-2">
              {available.map((d) => (
                <form key={d.id} action={setDraftCampaign} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                  <input type="hidden" name="draftId" value={d.id} />
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <input type="hidden" name="returnTo" value={`/campaigns/${campaign.id}`} />
                  <span className="min-w-0 truncate text-sm">{d.title}</span>
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-soft"
                  >
                    Attach
                  </button>
                </form>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
