import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { demoData } from "@/lib/demo-data";

const STATUS_TONE: Record<string, "neutral" | "accent" | "success" | "warning"> = {
  Draft: "neutral",
  "Ready for Review": "warning",
  Scheduled: "accent",
  Published: "success",
};

export default function PlannerPage() {
  const entries = demoData.upcoming.map((u, i) => ({
    id: `p${i}`,
    when: u.when,
    what: u.what,
    status: i === 0 ? "Scheduled" : "Draft",
  }));

  return (
    <>
      <PageHeader
        title="Content Planner"
        subtitle="Your content calendar. The full calendar with campaign linking arrives in Phase 7."
      />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-8 md:px-10">
        {entries.map((e) => (
          <Card key={e.id} className="flex items-center gap-4">
            <span className="w-20 shrink-0 font-mono text-xs text-text-faint">
              {e.when}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {e.what}
            </span>
            <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
          </Card>
        ))}
        <EmptyState
          title="Calendar view coming soon"
          description="Drag-and-drop scheduling, campaign association, and status filtering are part of Phase 7."
        />
        <p className="text-xs text-text-faint">
          Posting times shown are estimates, not real account analytics.
        </p>
      </div>
    </>
  );
}
