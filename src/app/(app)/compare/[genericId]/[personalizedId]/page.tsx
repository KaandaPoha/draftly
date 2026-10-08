import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/ui";
import { explainDraft } from "@/lib/why-draft";

export default async function CompareResultPage({
  params,
}: {
  params: Promise<{ genericId: string; personalizedId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { genericId, personalizedId } = await params;

  const [generic, personalized] = await Promise.all([
    prisma.contentDraft.findFirst({ where: { id: genericId, userId: user.id } }),
    prisma.contentDraft.findFirst({
      where: { id: personalizedId, userId: user.id },
      include: { profile: true },
    }),
  ]);

  if (!generic || !personalized) notFound();

  const whyGeneric = explainDraft({
    idea: generic.idea ?? "",
    profile: null,
    audience: generic.audience,
    platform: generic.platform,
    goal: generic.goal ?? "",
    format: generic.format ?? "post",
    variant: 0,
  });

  const whyPersonal = explainDraft(
    {
      idea: personalized.idea ?? "",
      profile: personalized.profile
        ? {
            name: personalized.profile.name,
            tone: personalized.profile.tone,
            wordsToUse: personalized.profile.wordsToUse,
            audience: personalized.profile.audience,
          }
        : null,
      audience: personalized.audience,
      platform: personalized.platform,
      goal: personalized.goal ?? "",
      format: personalized.format ?? "post",
      variant: 0,
    },
    personalized.profile?.tone
  );

  return (
    <>
      <PageHeader
        title="The comparison"
        subtitle={`Same idea — “${personalized.idea ?? generic.idea ?? ""}” — generated twice.`}
      />

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 md:px-10">
        <Link href="/compare" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
          <ArrowLeft size={15} aria-hidden /> New comparison
        </Link>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Generic */}
          <div className="flex flex-col gap-4">
            <Card className="border-warning/40">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">A · Generic draft</h2>
                <Badge tone="warning">No brand context</Badge>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                Built from the idea alone — no tone, vocabulary, or audience from
                any profile.
              </p>
            </Card>
            <DraftCard draft={generic} why={whyGeneric.bullets} />
          </div>

          {/* Personalized */}
          <div className="flex flex-col gap-4">
            <Card className="border-accent/40">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">B · Draftly personalized</h2>
                <Badge tone="accent">
                  {personalized.profile ? personalized.profile.name : "No profile selected"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                Shaped by your brand profile tone and word choices, your audience,
                and the platform conventions.
              </p>
            </Card>
            <DraftCard draft={personalized} why={whyPersonal.bullets} accent />
          </div>
        </div>

        {/* Differences summary */}
        <Card>
          <h2 className="font-display font-semibold">What changed and why</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-text-muted">
            <li>
              <strong className="text-text">Tone:</strong>{" "}
              {personalized.profile?.tone
                ? `draft B matches your saved “${personalized.profile.tone.toLowerCase()}” tone; draft A uses a neutral default.`
                : "no profile tone was set, so the drafts are closer than usual — pick a profile with a tone for a stronger contrast."}
            </li>
            <li>
              <strong className="text-text">Audience relevance:</strong>{" "}
              {personalized.profile?.audience || personalized.audience
                ? `draft B addresses ${personalized.audience ?? personalized.profile?.audience} directly; draft A stays general.`
                : "no audience was specified for either draft."}
            </li>
            <li>
              <strong className="text-text">Platform suitability:</strong> both
              drafts follow {personalized.platform} conventions — that input was
              shared, as was the goal ({personalized.goal ?? "not set"}).
            </li>
            <li>
              <strong className="text-text">Brand consistency:</strong>{" "}
              {personalized.profile?.wordsToUse
                ? "draft B weaves in your profile's preferred words; draft A cannot."
                : "add “words to use” on your profile to sharpen this contrast."}
            </li>
          </ul>
          <p className="mt-3 text-xs text-text-faint">
            This comparison is qualitative — it describes the drafts, not
            performance. No engagement numbers are claimed because none exist yet.
          </p>
        </Card>
      </div>
    </>
  );
}

function DraftCard({
  draft,
  why,
  accent,
}: {
  draft: {
    id: string;
    hook: string | null;
    body: string | null;
    cta: string | null;
    hashtags: string | null;
  };
  why: string[];
  accent?: boolean;
}) {
  return (
    <Card className={`flex flex-col gap-4 ${accent ? "border-accent/30" : ""}`}>
      <div>
        <span className="font-mono text-xs uppercase tracking-wider text-text-faint">Hook</span>
        <p className="mt-1 text-sm leading-relaxed">{draft.hook}</p>
      </div>
      <div>
        <span className="font-mono text-xs uppercase tracking-wider text-text-faint">Content</span>
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{draft.body}</p>
      </div>
      <div>
        <span className="font-mono text-xs uppercase tracking-wider text-text-faint">CTA</span>
        <p className="mt-1 text-sm leading-relaxed">{draft.cta}</p>
      </div>
      <div>
        <span className="font-mono text-xs uppercase tracking-wider text-text-faint">Why this draft</span>
        <ul className="mt-1 flex flex-col gap-1.5">
          {why.slice(0, 4).map((b) => (
            <li key={b} className="text-xs leading-relaxed text-text-muted">· {b}</li>
          ))}
        </ul>
      </div>
      <Link
        href={`/drafts/${draft.id}`}
        className="self-start text-sm font-medium text-accent hover:text-accent-strong"
      >
        Open full draft →
      </Link>
    </Card>
  );
}
