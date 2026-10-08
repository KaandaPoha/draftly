import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, History, Pencil, Trash2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/ui";
import { explainDraft } from "@/lib/why-draft";
import { checkBrandSafety } from "@/lib/brand-safety";
import { evaluateDraft } from "@/lib/quality";
import { draftFullText } from "@/lib/export";
import { SpeakButton } from "@/components/voice";
import { SafetyPanel } from "./safety-panel";
import { QualityPanel } from "./quality-panel";
import { CreativeAssets } from "./creative-assets";
import { acknowledgeReview } from "./export-actions";
import { applyTransform, saveEdits, restoreVersion, deleteDraft, regenerateDraft, translateDraftAction } from "./actions";
import { LANGUAGES } from "@/lib/translate";

// Reads the session cookie and the database — render per-request.
export const instant = false;

const TRANSFORMS: Array<{ kind: string; label: string }> = [
  { kind: "shorter", label: "Make it shorter" },
  { kind: "more_professional", label: "More professional" },
  { kind: "funnier", label: "Make it funnier" },
  { kind: "better_cta", label: "Improve the CTA" },
  { kind: "new_hook", label: "New hook" },
  { kind: "adapt_linkedin", label: "Adapt for LinkedIn" },
  { kind: "adapt_instagram", label: "Adapt for Instagram" },
];

export default async function DraftDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;
  const notice = sp.notice ? String(sp.notice) : null;

  const draft = await prisma.contentDraft.findFirst({
    where: { id, userId: user.id },
    include: { profile: true, versions: { orderBy: { createdAt: "desc" } } },
  });
  if (!draft) notFound();

  // Transparent heuristic quality evaluation — labelled as such in the UI.
  const quality = evaluateDraft(
    {
      hook: draft.hook,
      body: draft.body,
      caption: draft.caption,
      cta: draft.cta,
      hashtags: draft.hashtags,
    },
    {
      platform: draft.platform,
      goal: draft.goal ?? "",
      format: draft.format ?? "post",
      hasProfile: Boolean(draft.profile),
      audience: draft.audience,
    }
  );

  // "Why This Draft?" — derived from the stored inputs.
  const why = explainDraft(
    {
      idea: draft.idea ?? "",
      profile: draft.profile
        ? {
            name: draft.profile.name,
            tone: draft.profile.tone,
            wordsToUse: draft.profile.wordsToUse,
            audience: draft.profile.audience,
          }
        : null,
      audience: draft.audience,
      platform: draft.platform,
      goal: draft.goal ?? "",
      format: draft.format ?? "post",
      variant: draft.variant ?? 0,
    },
    draft.profile?.tone
  );

  return (
    <>
      <PageHeader title={draft.title} subtitle={`${draft.platform} · ${draft.format ?? "post"} · created ${draft.createdAt.toLocaleDateString()}`} />

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8 md:px-10">
        <Link href="/drafts" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
          <ArrowLeft size={15} aria-hidden /> All drafts
        </Link>

        {notice && (
          <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>
        )}

        {/* Why This Draft */}
        <Card className="border-accent/30">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" aria-hidden />
            <h2 className="font-display font-semibold">Why this draft?</h2>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {why.bullets.map((b) => (
              <li key={b} className="flex gap-2 text-sm leading-relaxed text-text-muted">
                <span className="text-accent" aria-hidden>·</span>
                {b}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-text-faint">
            Explanations are derived from your actual inputs (profile, audience,
            platform, goal, format) — not generic advice.
          </p>
        </Card>

        {/* Current content */}
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {draft.profile ? (
                <Badge tone="accent">Profile: {draft.profile.name}</Badge>
              ) : (
                <Badge tone="warning">Generic draft</Badge>
              )}
              {draft.goal && <Badge>Goal: {draft.goal}</Badge>}
              {draft.audience && <Badge>Audience: {draft.audience}</Badge>}
            </div>
            {/* Optional: read the draft aloud (browser TTS, hidden if unsupported) */}
            <SpeakButton text={`${draft.hook ?? ""}. ${draft.body ?? ""} ${draft.cta ?? ""}`} />
          </div>

          <Section title="Hook" text={draft.hook} />
          <Section title="Content" text={draft.body} pre />
          <Section title="Call to action" text={draft.cta} />
          <Section title="Hashtags" text={draft.hashtags} mono />
          <Section title="Visual direction" text={draft.visualNotes} />
        </Card>

        {/* Content quality evaluation */}
        <QualityPanel report={quality} draftId={draft.id} />

        {/* Generated creative assets: artboard, animated storyboard, shot list */}
        <CreativeAssets
          draftId={draft.id}
          title={draft.title}
          format={draft.format}
          storyboardRaw={draft.storyboard}
          artboardRaw={draft.imagePrompt}
          designRaw={draft.designSpec}
          mode={draft.generationMode}
          model={draft.model}
        />

        {/* Brand safety */}
        <SafetyPanel
          expanded
          report={checkBrandSafety(draftFullText(draft), {
            wordsToAvoid: draft.profile?.wordsToAvoid ?? null,
          })}
        />

        {/* Acknowledge review */}
        <Card className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-muted">
            Reviewed the safety findings and accept the draft as-is?
          </p>
          <form action={acknowledgeReview}>
            <input type="hidden" name="id" value={draft.id} />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-lg border border-success/40 px-3 text-sm font-medium text-success hover:bg-success/10"
            >
              Acknowledge review
            </button>
          </form>
        </Card>

        {/* Export */}
        <Card className="flex flex-col gap-3">
          <h2 className="font-display font-semibold">Export</h2>
          <p className="text-sm text-text-muted">
            Download the full draft as a file — no platform connection needed.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { format: "markdown", label: "Markdown (.md)" },
              { format: "json", label: "JSON (.json)" },
              { format: "text", label: "Plain text (.txt)" },
            ].map((f) => (
              <a
                key={f.format}
                href={`/api/drafts/${draft.id}/export?format=${f.format}`}
                className="rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-text-muted hover:border-accent hover:text-text"
              >
                {f.label}
              </a>
            ))}
            <Link
              href={`/preview?draft=${draft.id}`}
              className="rounded-full border border-accent bg-accent-soft px-4 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-background"
            >
              Publishing preview →
            </Link>
          </div>
        </Card>

        {/* Transformations */}
        <Card className="flex flex-col gap-3">
          <h2 className="font-display font-semibold">Improve this draft</h2>
          <p className="text-sm text-text-muted">
            Each action creates a new version — the current state is saved to
            history first, never overwritten.
          </p>
          <div className="flex flex-wrap gap-2">
            {TRANSFORMS.map((t) => (
              <form key={t.kind} action={applyTransform}>
                <input type="hidden" name="id" value={draft.id} />
                <input type="hidden" name="kind" value={t.kind} />
                <button
                  type="submit"
                  className="rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-text-muted transition-colors hover:border-accent hover:text-text"
                >
                  {t.label}
                </button>
              </form>
            ))}
          </div>

          {/* Full regeneration + translation — separate because they
              recompose the whole draft or change its language. */}
          <div className="mt-2 flex flex-wrap items-end gap-3 border-t border-line pt-4">
            <form action={regenerateDraft}>
              <input type="hidden" name="id" value={draft.id} />
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-background hover:bg-accent-strong"
              >
                Regenerate everything (new angle)
              </button>
            </form>

            <form action={translateDraftAction} className="flex items-end gap-2">
              <input type="hidden" name="id" value={draft.id} />
              <label className="flex flex-col gap-1 text-xs text-text-faint">
                Translate into
                <select
                  name="language"
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm text-text"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium text-text-muted hover:border-accent hover:text-text"
              >
                Translate
              </button>
            </form>
          </div>
          <p className="text-xs text-text-faint">
            Regeneration recomposes every line from your original idea. Translation
            uses your configured AI provider; without one, it marks the draft for
            translation rather than inventing text.
          </p>
        </Card>

        {/* Manual edit */}
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Pencil size={16} className="text-text-muted" aria-hidden />
            <h2 className="font-display font-semibold">Edit manually</h2>
          </div>
          <form action={saveEdits} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={draft.id} />
            <Field label="Hook" name="hook" defaultValue={draft.hook ?? ""} />
            <Field label="Content" name="body" defaultValue={draft.body ?? ""} textarea />
            <Field label="Call to action" name="cta" defaultValue={draft.cta ?? ""} />
            <Field label="Hashtags" name="hashtags" defaultValue={draft.hashtags ?? ""} mono />
            <button
              type="submit"
              className="self-start inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-background hover:bg-accent-strong"
            >
              Save edits
            </button>
          </form>
        </Card>

        {/* Version history */}
        {draft.versions.length > 0 && (
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <History size={16} className="text-text-muted" aria-hidden />
              <h2 className="font-display font-semibold">Version history</h2>
            </div>
            <ul className="flex flex-col gap-2">
              {draft.versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.label}</p>
                    <p className="text-xs text-text-faint">
                      {v.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <form action={restoreVersion}>
                    <input type="hidden" name="id" value={draft.id} />
                    <input type="hidden" name="versionId" value={v.id} />
                    <button
                      type="submit"
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-soft"
                    >
                      Restore
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Delete */}
        <Card className="flex items-center justify-between border-danger/30">
          <p className="text-sm text-text-muted">Delete this draft and all its versions.</p>
          <form action={deleteDraft}>
            <input type="hidden" name="id" value={draft.id} />
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-danger/40 px-3 text-sm font-medium text-danger hover:bg-danger/10"
            >
              <Trash2 size={14} aria-hidden /> Delete draft
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}

function Section({ title, text, pre, mono }: { title: string; text: string | null; pre?: boolean; mono?: boolean }) {
  if (!text) return null;
  return (
    <div>
      <span className="font-mono text-xs uppercase tracking-wider text-text-faint">{title}</span>
      <p className={`mt-1 text-sm leading-relaxed ${pre ? "whitespace-pre-line" : ""} ${mono ? "font-mono text-accent2 text-xs" : ""}`}>
        {text}
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  textarea,
  mono,
}: {
  label: string;
  name: string;
  defaultValue: string;
  textarea?: boolean;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label}
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={6}
          className={`rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent ${mono ? "font-mono text-xs" : ""}`}
        />
      ) : (
        <input
          name={name}
          defaultValue={defaultValue}
          className={`h-10 rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-accent ${mono ? "font-mono text-xs" : ""}`}
        />
      )}
    </label>
  );
}
