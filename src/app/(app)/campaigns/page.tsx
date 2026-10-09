// Per-request rendering (cookies + DB).
export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { createCampaign, deleteCampaign } from "./actions";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const error = sp.error ? String(sp.error) : null;

  const campaigns = await prisma.campaign.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      drafts: { select: { id: true, platform: true, status: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Group drafts into campaigns and track their progress."
      />

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8 md:px-10">
        {/* New campaign form */}
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Plus size={16} className="text-accent" aria-hidden />
            <h2 className="font-display font-semibold">New campaign</h2>
          </div>
          {error === "name" && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              Give the campaign a name.
            </p>
          )}
          <form action={createCampaign} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-1">
                Name *
                <input
                  name="name"
                  required
                  maxLength={120}
                  placeholder="e.g. Protein drink launch"
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-accent"
                />
                <span className="text-xs text-text-faint">
                  A short label you&apos;ll recognize — e.g. a product launch or festival series.
                </span>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                Start date
                <input
                  name="startDate"
                  type="date"
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-accent"
                />
                <span className="text-xs text-text-faint">Optional — when the campaign goes live.</span>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                End date
                <input
                  name="endDate"
                  type="date"
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-accent"
                />
                <span className="text-xs text-text-faint">Optional — leave blank for an ongoing campaign.</span>
              </label>
            </div>
            <button
              type="submit"
              className="self-start inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-background hover:bg-accent-strong"
            >
              Create campaign
            </button>
          </form>
        </Card>

        {/* List */}
        {campaigns.length === 0 && (
          <EmptyState
            title="No campaigns yet"
            description="Create a campaign to group related drafts — useful for launches and content series."
          />
        )}

        <div className="flex flex-col gap-3">
          {campaigns.map((c) => {
            const counts = c.drafts.reduce(
              (acc, d) => {
                acc[d.status] = (acc[d.status] ?? 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            );
            const active =
              (!c.startDate || c.startDate <= new Date()) &&
              (!c.endDate || c.endDate >= new Date());
            return (
              <Card key={c.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/campaigns/${c.id}`} className="min-w-0">
                    <h2 className="font-medium hover:text-accent">{c.name}</h2>
                    <p className="text-sm text-text-muted">
                      {c.drafts.length} draft{c.drafts.length === 1 ? "" : "s"}
                      {c.startDate ? ` · from ${c.startDate.toLocaleDateString()}` : ""}
                      {c.endDate ? ` to ${c.endDate.toLocaleDateString()}` : ""}
                    </p>
                  </Link>
                  <Badge tone={active && c.drafts.length > 0 ? "accent" : "neutral"}>
                    {active && c.drafts.length > 0 ? "Active" : "No posts yet"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(counts).map(([status, n]) => (
                    <Badge key={status} tone={status === "published" ? "success" : status === "scheduled" ? "accent" : "neutral"}>
                      {n} {status}
                    </Badge>
                  ))}
                  <form action={deleteCampaign} className="ml-auto">
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      aria-label={`Delete campaign ${c.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-text-faint">
          Campaigns group drafts only — Draftly never marks anything as
          published unless a real publishing action succeeded.
        </p>
      </div>
    </>
  );
}
