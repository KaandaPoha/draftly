import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Sparkles, Lightbulb, CalendarDays } from "lucide-react";
import { PageHeader, SectionHeader, StatTile, Badge, Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recommend, suggestedSlots } from "@/lib/recommendations";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profileCount, campaignCount, drafts, preferences] = await Promise.all([
    prisma.brandProfile.count({ where: { userId: user.id, isTemporary: false } }),
    prisma.campaign.count({ where: { userId: user.id } }),
    prisma.contentDraft.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.userPreferences.findUnique({ where: { userId: user.id } }),
  ]);

  const firstName = user.name?.split(" ")[0] ?? "there";
  const scheduledCount = drafts.filter((d) => d.status === "scheduled").length;

  const recommendations = recommend({
    goals: preferences?.goals ?? "",
    platforms: preferences?.platforms ?? "Instagram",
    profiles: await prisma.brandProfile
      .findMany({
        where: { userId: user.id, isTemporary: false },
        select: { name: true, niche: true, audience: true },
      })
      .then((ps) => ps.map((p) => ({ ...p, audience: p.audience ?? null }))),
    drafts: drafts.map((d) => ({
      title: d.title,
      platform: d.platform,
      goal: d.goal,
      format: d.format,
      isPersonalized: d.isPersonalized,
      createdAt: d.createdAt,
    })),
  });

  const slots = suggestedSlots((preferences?.platforms ?? "Instagram").split(","));

  return (
    <>
      <PageHeader
        title={`Good morning, ${firstName}`}
        subtitle="Your content command center — drafts, campaigns, and what to make next."
      />

      <div className="mx-auto flex flex-col gap-10 px-5 py-8 md:px-10">
        {/* Key numbers — real counts from your data */}
        <section aria-label="Your content at a glance">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Drafts" value={String(drafts.length)} hint="Most recent 10 shown below" />
            <StatTile label="Profiles" value={String(profileCount)} hint="Brand voices saved" />
            <StatTile label="Campaigns" value={String(campaignCount)} hint="Grouping your drafts" />
            <StatTile label="Scheduled" value={String(scheduledCount)} hint="On the calendar" />
          </div>
        </section>

        {/* Primary action */}
        <section
          aria-label="Create content"
          className="rounded-xl border border-line bg-gradient-to-br from-accent-soft via-surface to-surface p-6 md:p-8"
        >
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-accent" aria-hidden />
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  Create your next post
                </h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                Describe your idea, pick a brand voice profile, and Draftly
                generates platform-specific drafts — and explains why each one
                was written the way it was.
              </p>
            </div>
            <Link
              href="/create"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-background transition-colors hover:bg-accent-strong"
            >
              Start creating <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>

        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          {/* Recent drafts — real */}
          <section aria-label="Recent drafts" className="flex flex-col gap-4">
            <SectionHeader
              title="Recent drafts"
              subtitle="Your latest saved work"
              action={
                <Link
                  href="/drafts"
                  className="text-sm font-medium text-accent hover:text-accent-strong"
                >
                  View all
                </Link>
              }
            />
            {drafts.length === 0 ? (
              <Card className="text-sm text-text-muted">
                No drafts yet.{" "}
                <Link href="/create" className="text-accent">Create your first one</Link> — it takes about a minute.
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {drafts.slice(0, 5).map((draft) => (
                  <Card key={draft.id} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/drafts/${draft.id}`} className="font-medium hover:text-accent">
                        {draft.title}
                      </Link>
                      <Badge tone={draft.status === "published" ? "success" : draft.status === "scheduled" ? "accent" : "neutral"}>
                        {draft.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="accent">{draft.platform}</Badge>
                      {draft.isPersonalized ? (
                        <Badge>Personalized</Badge>
                      ) : (
                        <Badge tone="warning">Generic</Badge>
                      )}
                      <span className="ml-auto font-mono text-xs text-text-faint">
                        {draft.createdAt.toLocaleDateString()}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Side column — real recommendations */}
          <div className="flex flex-col gap-10">
            <section aria-label="Recommended for you" className="flex flex-col gap-4">
              <SectionHeader
                title="Recommended for you"
                subtitle="Based on your goals, profiles, and drafts"
              />
              <div className="flex flex-col gap-3">
                {recommendations.map((rec) => (
                  <Card key={rec.title} className="flex flex-col gap-2">
                    <div className="flex gap-3">
                      <Lightbulb size={18} className="mt-0.5 shrink-0 text-accent2" aria-hidden />
                      <div>
                        <h3 className="text-sm font-medium">{rec.title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-text-muted">
                          {rec.detail}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pl-8">
                      <span className="text-[11px] text-text-faint">{rec.reason}</span>
                      {rec.cta && (
                        <Link
                          href={rec.cta.href}
                          className="shrink-0 text-xs font-medium text-accent hover:text-accent-strong"
                        >
                          {rec.cta.label} →
                        </Link>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
              <p className="text-xs text-text-faint">
                Suggestions are generated from your saved goals and history —
                not real-time trend data.
              </p>
            </section>

            <section aria-label="This week's windows" className="flex flex-col gap-4">
              <SectionHeader
                title="Suggested windows"
                subtitle="Estimates for your platforms"
                action={
                  <Link
                    href="/planner"
                    className="text-sm font-medium text-accent hover:text-accent-strong"
                  >
                    Planner
                  </Link>
                }
              />
              <Card className="flex flex-col gap-3">
                {slots.map((s) => (
                  <div key={s.when} className="flex items-center gap-3 text-sm">
                    <CalendarDays size={15} className="shrink-0 text-text-faint" aria-hidden />
                    <span className="font-mono text-xs text-text-faint">{s.when}</span>
                    <span className="ml-auto text-right text-text-muted">{s.platform}</span>
                  </div>
                ))}
              </Card>
              <p className="text-xs text-text-faint">
                Posting times are estimates until real account analytics are connected.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
