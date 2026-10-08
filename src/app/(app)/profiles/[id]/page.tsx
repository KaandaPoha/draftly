import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge, SecondaryButton, Tabs } from "@/components/ui";
import { reanalyzeProfile, deleteProfile, setStyleOverride } from "../actions";

// Reads the session cookie and the database — render per-request.
export const instant = false;

const TRAIT_LABELS: Record<string, string> = {
  formality: "Formality",
  humor: "Humor",
  sentenceLength: "Sentence length",
  emojiUsage: "Emoji usage",
  vocabulary: "Vocabulary",
  promotionalIntensity: "Promotional intensity",
  storytelling: "Storytelling",
};

/** Valid options per trait, mirroring the StyleAnalysis type. */
const TRAIT_OPTIONS: Record<string, string[]> = {
  formality: ["informal", "neutral", "formal"],
  humor: ["low", "some", "high"],
  sentenceLength: ["short", "medium", "long"],
  emojiUsage: ["none", "light", "frequent"],
  vocabulary: ["simple", "moderate", "rich"],
  promotionalIntensity: ["low", "medium", "high"],
  storytelling: ["low", "moderate", "strong"],
};

type StyleAnalysisShape = {
  overrides?: Record<string, string>;
} & Record<string, unknown>;

export default async function ProfileDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const spTab = (await searchParams).tab;

  const profile = await prisma.brandProfile.findFirst({
    where: { id, userId: user.id, isTemporary: false },
    include: {
      samplePosts: { orderBy: { createdAt: "desc" }, select: { id: true, content: true } },
    },
  });
  if (!profile) notFound();

  const raw = profile.styleAnalysis
    ? (JSON.parse(profile.styleAnalysis) as StyleAnalysisShape)
    : null;
  const overrides = raw?.overrides ?? {};

  // Traits actually inferred from samples (excludes the overrides key).
  const inferred = Object.entries(raw ?? {}).filter(
    ([key, value]) => key in TRAIT_LABELS && typeof value === "string"
  ) as Array<[string, string]>;

  const hasSamples = profile.samplePosts.length > 0;

  // Tabbed layout — selected via a query parameter so everything stays
  // server-rendered and works without client JavaScript.
  const TAB_IDS = ["details", "style", "samples"] as const;
  const tab = TAB_IDS.includes(spTab as never) ? (spTab as string) : "details";

  return (
    <>
      <PageHeader
        title={profile.name}
        subtitle={profile.niche ?? "Brand / creator profile"}
      />
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8 md:px-10">
        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-3">
          <Link href={`/profiles/${profile.id}/edit`}>
            <SecondaryButton type="button">Edit profile</SecondaryButton>
          </Link>
          <form action={deleteProfile}>
            <input type="hidden" name="id" value={profile.id} />
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
            >
              Delete profile
            </button>
          </form>
        </div>

        <Tabs
          basePath={`/profiles/${profile.id}`}
          current={tab}
          tabs={[
            { id: "details", label: "Details" },
            { id: "style", label: "Style" },
            { id: "samples", label: "Samples", badge: profile.samplePosts.length },
          ]}
        />

        {tab === "details" && (
          <>
        <Card className="flex flex-col gap-3">
          <h2 className="font-display font-semibold">Profile details</h2>
          <dl className="flex flex-col gap-2 text-sm">
            {(
              [
                ["Description", profile.description],
                ["Industry / niche", profile.niche],
                ["Products or services", profile.offerings],
                ["Target audience", profile.audience],
                ["Preferred platforms", profile.platforms],
                ["Preferred language", profile.language],
                ["Preferred tone", profile.tone],
                ["Words to use", profile.wordsToUse],
                ["Words to avoid", profile.wordsToAvoid],
                ["Brand guidelines", profile.guidelines],
                ["Colors / visuals", profile.colors],
              ] as const
            )
              .filter(([, v]) => Boolean(v))
              .map(([label, v]) => (
                <div key={label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                  <dt className="w-48 shrink-0 text-text-faint">{label}</dt>
                  <dd className="text-text">{v}</dd>
                </div>
              ))}
            {!profile.description && !profile.niche && !profile.offerings &&
              !profile.audience && !profile.platforms && !profile.language &&
              !profile.tone && !profile.wordsToUse && !profile.wordsToAvoid &&
              !profile.guidelines && !profile.colors && (
              <p className="text-text-muted">
                Only the name is set — add details via “Edit profile” so Draftly
                can personalize drafts.
              </p>
            )}
          </dl>
        </Card>
          </>
        )}

        {tab === "style" && (
          <>
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display font-semibold">Style characteristics</h2>
            {hasSamples && (
              <form action={reanalyzeProfile}>
                <input type="hidden" name="id" value={profile.id} />
                <input type="hidden" name="returnTo" value={`/profiles/${profile.id}`} />
                <SecondaryButton type="submit">Re-run analysis</SecondaryButton>
              </form>
            )}
          </div>

          {!hasSamples && (
            <p className="text-sm leading-relaxed text-text-muted">
              No sample posts yet. Draftly has <strong>not</strong> learned this
              brand&apos;s style — add samples via “Edit profile” and the analysis
              will appear here.
            </p>
          )}

          {inferred.length > 0 && (
            <p className="text-xs text-text-faint">
              AI-inferred from your sample posts — heuristics, not proof. Change
              any value below; your choice overrides the inference.
            </p>
          )}

          {inferred.length === 0 && raw && (
            <p className="text-sm text-text-muted">
              The analysis found nothing distinctive yet — add more sample posts.
            </p>
          )}

          {inferred.map(([key, inferredValue]) => {
            const override = overrides[key];
            return (
              <div
                key={key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium">{TRAIT_LABELS[key] ?? key}</span>
                  <Badge tone={override ? "warning" : "accent"}>
                    {override ?? inferredValue}
                  </Badge>
                  {override && (
                    <span className="text-xs text-text-faint">
                      (inferred: {inferredValue})
                    </span>
                  )}
                </div>
                {/* Override: a no-JS select + submit per trait */}
                <form action={setStyleOverride} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={profile.id} />
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="returnTo" value={`/profiles/${profile.id}`} />
                  <label className="sr-only" htmlFor={`ov-${key}`}>
                    Change {TRAIT_LABELS[key] ?? key}
                  </label>
                  <select
                    id={`ov-${key}`}
                    name="value"
                    defaultValue={override ?? ""}
                    className="h-8 rounded-lg border border-line bg-surface px-2 text-xs"
                  >
                    <option value="">Inferred ({inferredValue})</option>
                    {TRAIT_OPTIONS[key]?.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="h-8 rounded-lg border border-line bg-surface px-3 text-xs font-medium hover:bg-surface-2"
                  >
                    Apply
                  </button>
                </form>
              </div>
            );
          })}
        </Card>
          </>
        )}

        {tab === "samples" && (
          <>
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display font-semibold">
              Sample posts ({profile.samplePosts.length})
            </h2>
            <Link href={`/profiles/${profile.id}/edit`} className="text-xs text-accent hover:underline">
              + Add samples
            </Link>
          </div>
          {profile.samplePosts.length === 0 ? (
            <p className="text-sm text-text-muted">
              No samples yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {profile.samplePosts.map((s) => (
                <li
                  key={s.id}
                  className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed"
                >
                  {s.content}
                </li>
              ))}
            </ul>
          )}
        </Card>
          </>
        )}
      </div>
    </>
  );
}
