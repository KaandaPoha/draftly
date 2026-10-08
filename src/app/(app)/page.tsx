import Link from "next/link";
import { ArrowRight, Sparkles, Lightbulb, CalendarDays } from "lucide-react";
import { PageHeader, SectionHeader, StatTile, Badge, Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { demoData } from "@/lib/demo-data";

export default async function DashboardPage() {
  const d = demoData;
  const user = await getCurrentUser();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <>
      <PageHeader
        title={`Good morning, ${firstName}`}
        subtitle="Here's where your content stands this week. Sample data is shown until you create drafts."
      />

      <div className="mx-auto flex flex-col gap-10 px-5 py-8 md:px-10">
        {/* Key numbers */}
        <section aria-label="This week at a glance">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Drafts" value={String(d.stats.drafts)} hint="Created this week" />
            <StatTile label="Profiles" value={String(d.stats.profiles)} hint="Brand voices saved" />
            <StatTile label="Campaigns" value={String(d.stats.campaigns)} hint="Active right now" />
            <StatTile label="Scheduled" value={String(d.stats.scheduled)} hint="Awaiting publish" />
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
          {/* Recent drafts */}
          <section aria-label="Recent drafts" className="flex flex-col gap-4">
            <SectionHeader
              title="Recent drafts"
              subtitle="Your latest generated content"
              action={
                <Link
                  href="/campaigns"
                  className="text-sm font-medium text-accent hover:text-accent-strong"
                >
                  View all
                </Link>
              }
            />
            <div className="flex flex-col gap-3">
              {d.recentDrafts.map((draft) => (
                <Card key={draft.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium">{draft.title}</h3>
                    <Badge tone={draft.status === "ready" ? "success" : "neutral"}>
                      {draft.status === "ready" ? "Ready for review" : "Draft"}
                    </Badge>
                  </div>
                  <p className="text-sm text-text-muted">{draft.excerpt}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge tone="accent">{draft.platform}</Badge>
                    <Badge>{draft.profile}</Badge>
                    <span className="ml-auto font-mono text-xs text-text-faint">
                      {draft.date}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* Side column */}
          <div className="flex flex-col gap-10">
            <section aria-label="Recommended for you" className="flex flex-col gap-4">
              <SectionHeader
                title="Recommended for you"
                subtitle="AI-generated ideas"
              />
              <div className="flex flex-col gap-3">
                {d.recommendations.map((rec) => (
                  <Card key={rec.title} className="flex gap-3">
                    <Lightbulb size={18} className="mt-0.5 shrink-0 text-accent2" aria-hidden />
                    <div>
                      <h3 className="text-sm font-medium">{rec.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-text-muted">
                        {rec.detail}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
              <p className="text-xs text-text-faint">
                Suggestions are AI-generated estimates based on your profile —
                not real-time trend data.
              </p>
            </section>

            <section aria-label="Upcoming schedule" className="flex flex-col gap-4">
              <SectionHeader
                title="This week's plan"
                subtitle="Tentative schedule"
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
                {d.upcoming.map((slot) => (
                  <div key={slot.when} className="flex items-center gap-3 text-sm">
                    <CalendarDays size={15} className="shrink-0 text-text-faint" aria-hidden />
                    <span className="font-mono text-xs text-text-faint">{slot.when}</span>
                    <span className="ml-auto text-right text-text-muted">{slot.what}</span>
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
