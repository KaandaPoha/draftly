import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, History, Pencil, Trash2, RefreshCw, Image as ImageIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge, Tabs } from "@/components/ui";
import { explainDraft } from "@/lib/why-draft";
import { checkBrandSafety } from "@/lib/brand-safety";
import { evaluateDraft } from "@/lib/quality";
import { draftFullText } from "@/lib/export";
import { draftCopyText } from "@/lib/draft-helpers";
import { SpeakButton } from "@/components/voice";
import { CopyButton } from "@/components/copy-button";
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
  // Arrival reason: "failed" styles the banner as an error; any other notice is
  // a success. Read below in the banner block.
  const failed = sp.reason === "failed";

  // Tabbed layout — the selected tab is a query parameter so the whole page
  // stays server-rendered and works without client JavaScript.
  const TAB_IDS = ["content", "insights", "visual", "review", "export", "improve", "history"] as const;
  const tab = TAB_IDS.includes(sp.tab as never) ? (sp.tab as string) : "content";

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

  const copyAll = draftCopyText({
    title: draft.title,
    hook: draft.hook,
    body: draft.body,
    caption: draft.caption,
    hashtags: draft.hashtags,
    cta: draft.cta,
  });

  return (
    <>
      <PageHeader
        title={draft.title}
        subtitle={`${draft.platform} · ${draft.format ?? "post"} · created ${draft.createdAt.toLocaleDateString()}`}
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/drafts" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
            <ArrowLeft size={15} aria-hidden /> All drafts
          </Link>
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent hover:text-background"
          >
            <Sparkles size={14} aria-hidden /> Create another draft
          </Link>
        </div>

        {notice && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              failed === true ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
            }`}
          >
            {notice}
          </p>
        )}

        {/* Honest generation status — never claims AI for a built-in fallback. */}
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {draft.generationMode === "llm" ? (
              <Badge tone="accent">
                <Sparkles size={11} aria-hidden /> AI-generated · {draft.model ?? "model unknown"}
              </Badge>
            ) : (
              <Badge tone="warning">Built-in generator — not AI</Badge>
            )}
            {(draft as { sourceImage?: string | null }).sourceImage && (
              <Badge tone="neutral">
                <ImageIcon size={11} aria-hidden /> Generated from your image
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {draft.goal && <Badge>Goal: {draft.goal}</Badge>}
            {draft.audience && <Badge>Audience: {draft.audience}</Badge>}
          </div>
          <SpeakButton text={`${draft.hook ?? ""}. ${draft.body ?? ""} ${draft.cta ?? ""}`} />
        </Card>

        {/* Tab bar — server-rendered; the tab id lives in the query string. */}
        <Tabs
          basePath={`/drafts/${draft.id}`}
          current={tab}
          tabs={[
            { id: "content", label: "Content" },
            { id: "insights", label: "Insights" },
            { id: "visual", label: "Visual" },
            { id: "review", label: "Review" },
            { id: "export", label: "Export" },
            { id: "improve", label: "Improve" },
            { id: "history", label: "History", badge: draft.versions.length },
          ]}
          params={{ notice: notice ?? undefined, reason: failed ? "failed" : undefined }}
        />

        {tab === "content" && (
          <>
            {/* Current content — copy buttons on every section */}
            <Card className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display font-semibold">Draft content</h2>
                <CopyButton text={copyAll} label="Copy all" />
              </div>

              <Section title="Hook" text={draft.hook} pre onCopy={draft.hook ?? ""} />
              <Section title="Content" text={draft.body} pre onCopy={draft.body ?? ""} />
              <Section title="Caption" text={draft.caption} pre onCopy={draft.caption ?? ""} />
              <Section title="Call to action" text={draft.cta} onCopy={draft.cta ?? ""} />
              <Section title="Hashtags" text={draft.hashtags} mono onCopy={draft.hashtags ?? ""} />
              <Section title="Visual direction" text={draft.visualNotes} />
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
                <Field label="Caption" name="caption" defaultValue={draft.caption ?? ""} textarea />
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
          </>
        )}

        {tab === "insights" && (
          <>
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

            {/* Content quality evaluation */}
            <QualityPanel report={quality} draftId={draft.id} />
          </>
        )}

        {tab === "visual" && (
          <>
            {/* Generated creative assets: artboard, animated storyboard, shot list.
                Empty state: not every draft has visual data (e.g. generated
                before this feature, or the provider skipped the artboard). */}
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
          </>
        )}

        {tab === "review" && (
          <>
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
          </>
        )}

        {tab === "export" && (
          <>
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
          </>
        )}

        {tab === "improve" && (
          <>
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
                <form action={regenerateDraft} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
                  <input type="hidden" name="id" value={draft.id} />
                  <label className="flex flex-1 flex-col gap-1 text-xs text-text-faint">
                    Regenerate with a new instruction (optional)
                    <input
                      name="instruction"
                      placeholder="e.g. keep it under 80 words, mention the evening energy crash"
                      maxLength={300}
                      className="h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent sm:w-96"
                    />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-background hover:bg-accent-strong"
                  >
                    <RefreshCw size={14} aria-hidden /> Regenerate
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
          </>
        )}

        {tab === "history" && (
          <>
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
          </>
        )}
      </div>
    </>
  );
}

function Section({
  title,
  text,
  pre,
  mono,
  onCopy,
}: {
  title: string;
  text: string | null;
  pre?: boolean;
  mono?: boolean;
  onCopy?: string;
}) {
  if (!text) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-text-faint">{title}</span>
        {onCopy ? <CopyButton text={onCopy} label="Copy" /> : null}
      </div>
      <p className={`text-sm leading-relaxed ${pre ? "whitespace-pre-line" : ""} ${mono ? "font-mono text-accent2 text-xs" : ""}`}>
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
