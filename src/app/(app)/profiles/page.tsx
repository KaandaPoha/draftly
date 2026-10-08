import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { deleteProfile } from "./actions";

// Reads the session cookie and the database — render per-request.
export const instant = false;

export default async function ProfilesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profiles = await prisma.brandProfile.findMany({
    where: { userId: user.id, isTemporary: false },
    orderBy: { createdAt: "desc" },
    include: { samplePosts: { select: { id: true } } },
  });

  return (
    <>
      <PageHeader
        title="Brand & Creator Profiles"
        subtitle="Saved brand voices that power personalized drafts."
      />
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8 md:px-10">
        <div className="flex justify-end">
          <Link
            href="/profiles/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            New profile
          </Link>
        </div>

        {profiles.length === 0 && (
          <EmptyState
            title="No profiles yet"
            description="Create your first brand voice profile, paste a few sample posts, and Draftly will infer its style characteristics."
            action={
              <Link
                href="/profiles/new"
                className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Create a profile
              </Link>
            }
          />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((p) => (
            <Card key={p.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display font-semibold">
                    <Link href={`/profiles/${p.id}`} className="hover:text-accent">
                      {p.name}
                    </Link>
                  </h2>
                  {p.niche && <p className="text-sm text-text-muted">{p.niche}</p>}
                </div>
                {/* Delete: plain form, no JS. Confirmation is handled inline. */}
                <form action={deleteProfile}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    aria-label={`Delete ${p.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger"
                  >
                    Delete
                  </button>
                </form>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="accent">{p.samplePosts.length} samples</Badge>
                {p.tone && <Badge>{p.tone}</Badge>}
                {p.platforms && <Badge>{p.platforms}</Badge>}
              </div>

              {p.styleAnalysis && (
                <p className="text-xs text-text-muted">
                  Style detected —{" "}
                  <Link href={`/profiles/${p.id}`} className="text-accent hover:underline">
                    view details
                  </Link>
                </p>
              )}

              <Link
                href={`/profiles/${p.id}/edit`}
                className="text-xs text-text-muted hover:text-text"
              >
                Edit profile
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
