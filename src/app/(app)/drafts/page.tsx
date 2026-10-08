import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge, EmptyState, PrimaryButton } from "@/components/ui";

export default async function DraftsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const drafts = await prisma.contentDraft.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { profile: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader
        title="Drafts"
        subtitle="Everything you've saved, with full version history."
      />
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8 md:px-10">
        <div className="flex justify-end gap-3">
          <Link href="/create">
            <PrimaryButton type="button">New draft</PrimaryButton>
          </Link>
        </div>

        {drafts.length === 0 && (
          <EmptyState
            title="No drafts yet"
            description="Generate a draft in the Create Studio and save it — it will appear here with version history."
            action={
              <Link href="/create">
                <PrimaryButton type="button">Create content</PrimaryButton>
              </Link>
            }
          />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {drafts.map((d) => (
            <Card key={d.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium leading-snug">{d.title}</h2>
                <Badge tone={d.isPersonalized ? "accent" : "warning"}>
                  {d.isPersonalized ? "Personalized" : "Generic"}
                </Badge>
              </div>
              <p className="line-clamp-2 text-sm text-text-muted">{d.hook}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{d.platform}</Badge>
                {d.profile && <Badge>{d.profile.name}</Badge>}
                <Badge>{d.status === "draft" ? "Draft" : d.status}</Badge>
                <Link
                  href={`/drafts/${d.id}`}
                  className="ml-auto text-sm font-medium text-accent hover:text-accent-strong"
                >
                  Open
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
