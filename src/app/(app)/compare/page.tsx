import { redirect } from "next/navigation";
import { Scale } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, PrimaryButton } from "@/components/ui";
import { compareAction } from "./actions";
import { PLATFORMS, GOALS } from "@/lib/form-options";

// Reads the session cookie and the database — render per-request.
export const instant = false;

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const error = sp.error ? String(sp.error) : null;

  const profiles = await prisma.brandProfile.findMany({
    where: { userId: user.id, isTemporary: false },
    select: { id: true, name: true, tone: true },
  });

  return (
    <>
      <PageHeader
        title="Generic vs. Draftly"
        subtitle="Two drafts from the same idea — one generic, one shaped by your brand voice. See the difference for yourself."
      />
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8 md:px-10">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-accent" aria-hidden />
            <h2 className="font-display font-semibold">Set up the comparison</h2>
          </div>
          <p className="text-sm text-text-muted">
            Both drafts use the same idea, platform, goal, and format. The only
            difference: draft B gets your brand profile context.
          </p>

          {error === "idea" && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              Describe your idea first.
            </p>
          )}

          <form action={compareAction} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              Your idea *
              <textarea
                name="idea"
                rows={3}
                required
                minLength={3}
                maxLength={2000}
                placeholder='e.g. "We are launching a new chocolate drink for college students."'
                className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                Platform
                <select
                  name="platform"
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
                >
                  {PLATFORMS.filter((p) => p !== "Other").map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                Goal
                <select
                  name="goal"
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
                >
                  {GOALS.filter((g) => g !== "Other").map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                Format
                <select
                  name="format"
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
                >
                  <option value="post">Full post</option>
                  <option value="captions">Caption</option>
                  <option value="reel">Reel — script + storyboard</option>
                  <option value="video_script">Short-form video script</option>
                  <option value="carousel">Carousel outline</option>
                  <option value="hooks">Hooks (5 options)</option>
                  <option value="hashtags">Hashtag set</option>
                  <option value="image_concept">Image / visual concept</option>
                  <option value="animation">Animation concept</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                Brand profile (for draft B)
                <select
                  name="profileId"
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
                >
                  <option value="">No profile</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.tone ? ` · ${p.tone}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              Audience (optional)
              <input
                name="audience"
                maxLength={500}
                placeholder="e.g. 18–24, college students in metros"
                className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
              />
            </label>

            <PrimaryButton type="submit">Generate comparison</PrimaryButton>
          </form>
        </Card>

        <p className="text-xs text-text-faint">
          When no AI key is configured, both drafts come from the built-in
          generator — the difference comes entirely from how much of your
          profile context each draft is allowed to use. With a key set, both
          drafts are real AI generations, labelled with the model that made them.
        </p>
      </div>
    </>
  );
}
