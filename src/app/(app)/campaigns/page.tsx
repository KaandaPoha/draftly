import { PageHeader, StatTile, Card, Badge } from "@/components/ui";

export default function CampaignsPage() {
  return (
    <>
      <PageHeader
        title="Campaigns & History"
        subtitle="Group drafts into campaigns and track their progress. Full campaign management arrives in Phase 7."
      />
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-5 py-8 md:px-10">
        <div className="grid grid-cols-3 gap-4">
          <StatTile label="Active" value="2" hint="Campaigns running" />
          <StatTile label="Drafts" value="12" hint="Across all campaigns" />
          <StatTile label="Published" value="0" hint="Via Draftly (demo)" />
        </div>

        <div className="flex flex-col gap-3">
          {[
            {
              name: "Protein drink launch",
              detail: "6 drafts · Instagram + YouTube · Oct 10 – Oct 24",
              status: "Active",
            },
            {
              name: "Carbon-neutral packaging story",
              detail: "3 drafts · LinkedIn · Oct 5 – Oct 12",
              status: "Active",
            },
            {
              name: "Meal-prep myth series",
              detail: "5 drafts · Instagram · Sep 1 – Sep 30",
              status: "Completed",
            },
          ].map((c) => (
            <Card key={c.name} className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-medium">{c.name}</h2>
                <p className="mt-0.5 text-sm text-text-muted">{c.detail}</p>
              </div>
              <Badge tone={c.status === "Active" ? "accent" : "neutral"}>
                {c.status}
              </Badge>
            </Card>
          ))}
        </div>
        <p className="text-xs text-text-faint">
          Demo data — publishing integrations are not connected, so nothing shows
          as published unless it actually happened.
        </p>
      </div>
    </>
  );
}
