// Per-request rendering (cookies + DB).
export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/ui";
import { suggestedSlots } from "@/lib/recommendations";
import { scheduleDraft, unschedule, markPublished } from "./actions";

const STATUS_TONE: Record<string, "neutral" | "accent" | "success"> = {
  draft: "neutral",
  scheduled: "accent",
  published: "success",
};

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const notice = sp.notice ? String(sp.notice) : null;
  const error = sp.error ? String(sp.error) : null;

  const [entries, drafts, preferences] = await Promise.all([
    prisma.calendarEntry.findMany({
      where: { userId: user.id },
      orderBy: { scheduledFor: "asc" },
      include: { draft: { select: { title: true } } },
    }),
    prisma.contentDraft.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, platform: true, campaignId: true },
    }),
    prisma.userPreferences.findUnique({ where: { userId: user.id } }),
  ]);

  const platforms = (preferences?.platforms ?? "Instagram").split(",").map((p) => p.trim());
  const slots = suggestedSlots(platforms);
  const now = new Date();
  const upcoming = entries.filter((e) => e.scheduledFor >= now && e.status !== "published");
  const past = entries.filter((e) => e.scheduledFor < now || e.status === "published");

  return (
    <>
      <PageHeader
        title="Content Planner"
        subtitle="Schedule drafts to a calendar. Publishing itself stays manual until official platform APIs are connected."
      />

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8 md:px-10">
        {notice && (
          <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        {/* Schedule a draft */}
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-accent" aria-hidden />
            <h2 className="font-display font-semibold">Schedule a draft</h2>
          </div>
          {drafts.length === 0 ? (
            <p className="text-sm text-text-muted">
              You have no drafts yet —{" "}
              <Link href="/create" className="text-accent">create one first</Link>.
            </p>
          ) : (
            <form action={scheduleDraft} className="grid gap-4 sm:grid-cols-4">
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                Draft *
                <select
                  name="draftId"
                  required
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
                >
                  {drafts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                Platform
                <select
                  name="platform"
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
                >
                  {platforms.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                When *
                <input
                  name="scheduledFor"
                  type="datetime-local"
                  required
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
                />
              </label>
              <button
                type="submit"
                className="self-start sm:col-span-4 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-background hover:bg-accent-strong"
              >
                Schedule
              </button>
            </form>
          )}
        </Card>

        {/* Upcoming */}
        <Card className="flex flex-col gap-4">
          <h2 className="font-display font-semibold">Upcoming ({upcoming.length})</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-text-muted">Nothing scheduled yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                  <span className="font-mono text-xs text-text-faint">
                    {e.scheduledFor.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {e.draft?.title ?? "Draft removed"}
                  </span>
                  <Badge>{e.platform}</Badge>
                  <Badge tone={STATUS_TONE[e.status] ?? "neutral"}>{e.status}</Badge>
                  <form action={markPublished}>
                    <input type="hidden" name="entryId" value={e.id} />
                    <button type="submit" className="text-xs font-medium text-success hover:underline">
                      Mark published
                    </button>
                  </form>
                  <form action={unschedule}>
                    <input type="hidden" name="entryId" value={e.id} />
                    <button type="submit" className="text-xs text-text-muted hover:text-danger">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Past */}
        {past.length > 0 && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">History ({past.length})</h2>
            <ul className="flex flex-col gap-2">
              {past.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 opacity-70">
                  <span className="font-mono text-xs text-text-faint">
                    {e.scheduledFor.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {e.draft?.title ?? "Draft removed"}
                  </span>
                  <Badge>{e.platform}</Badge>
                  <Badge tone={STATUS_TONE[e.status] ?? "neutral"}>{e.status}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Suggested slots */}
        <Card className="flex flex-col gap-3">
          <h2 className="font-display font-semibold">Suggested posting windows</h2>
          <ul className="flex flex-col gap-2 text-sm text-text-muted">
            {slots.map((s) => (
              <li key={s.when} className="flex gap-3">
                <span className="font-mono text-xs text-text-faint">{s.when}</span>
                <span>{s.note} for {s.platform}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-faint">
            These windows are general estimates — real best-times come from your
            account analytics once connected. Nothing is auto-published; every
            status change here is an explicit action by you.
          </p>
        </Card>
      </div>
    </>
  );
}
