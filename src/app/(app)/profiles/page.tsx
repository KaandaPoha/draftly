"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Sparkles, FileText } from "lucide-react";
import { PageHeader, Card, Badge, PrimaryButton, SecondaryButton } from "@/components/ui";
import type { StyleAnalysis } from "@/lib/style-analysis";

type SamplePost = { id: string; content: string; createdAt: string };

type Profile = {
  id: string;
  name: string;
  description: string | null;
  niche: string | null;
  offerings: string | null;
  audience: string | null;
  platforms: string | null;
  language: string | null;
  tone: string | null;
  wordsToUse: string | null;
  wordsToAvoid: string | null;
  guidelines: string | null;
  colors: string | null;
  styleAnalysis: StyleAnalysis | null;
  samplePosts: SamplePost[];
};

const EMPTY = {
  name: "",
  description: "",
  niche: "",
  offerings: "",
  audience: "",
  platforms: "",
  language: "English",
  tone: "",
  wordsToUse: "",
  wordsToAvoid: "",
  guidelines: "",
  colors: "",
};

type FormState = typeof EMPTY;

const FIELDS: Array<{
  key: keyof typeof EMPTY;
  label: string;
  placeholder: string;
  textarea?: boolean;
}> = [
  { key: "description", label: "Description", placeholder: "What does this brand or creator do?", textarea: true },
  { key: "niche", label: "Industry / niche", placeholder: "e.g. Health food & beverages" },
  { key: "offerings", label: "Products or services", placeholder: "What do you sell or offer?" },
  { key: "audience", label: "Target audience", placeholder: "Who is this content for?" },
  { key: "platforms", label: "Preferred platforms", placeholder: "e.g. Instagram, LinkedIn" },
  { key: "language", label: "Preferred language", placeholder: "English" },
  { key: "tone", label: "Preferred tone", placeholder: "e.g. Friendly & casual" },
  { key: "wordsToUse", label: "Words / phrases to use", placeholder: "Comma separated" },
  { key: "wordsToAvoid", label: "Words / phrases to avoid", placeholder: "Comma separated" },
  { key: "guidelines", label: "Brand guidelines", placeholder: "Anything the content must respect", textarea: true },
  { key: "colors", label: "Colors / visual preferences", placeholder: "Optional" },
];

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [editing, setEditing] = useState<Profile | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [newSamples, setNewSamples] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/profiles");
    if (res.ok) {
      const data = await res.json();
      setProfiles(data.profiles);
    } else {
      setProfiles([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profiles")
      .then((r) => (r.ok ? r.json() : { profiles: [] }))
      .then((data) => {
        if (!cancelled) setProfiles(data.profiles);
      })
      .catch(() => {
        if (!cancelled) setProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function startNew() {
    setForm(EMPTY);
    setNewSamples("");
    setEditing("new");
    setError(null);
  }

  function startEdit(p: Profile) {
    setForm({
      name: p.name,
      description: p.description ?? "",
      niche: p.niche ?? "",
      offerings: p.offerings ?? "",
      audience: p.audience ?? "",
      platforms: p.platforms ?? "",
      language: p.language ?? "",
      tone: p.tone ?? "",
      wordsToUse: p.wordsToUse ?? "",
      wordsToAvoid: p.wordsToAvoid ?? "",
      guidelines: p.guidelines ?? "",
      colors: p.colors ?? "",
    });
    setNewSamples("");
    setEditing(p);
    setError(null);
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Profile name is required");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      ...form,
      ...(newSamples.trim()
        ? {
            samples: newSamples
              .split(/\n---\n/)
              .map((s) => s.trim())
              .filter(Boolean),
          }
        : {}),
      ...(editing !== "new" ? { reanalyze: true } : {}),
    };

    const res = editing === "new"
      ? await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch(`/api/profiles/${(editing as Profile).id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    setSaving(false);
    if (!res || !res.ok) {
      const data = res ? await res.json().catch(() => null) : null;
      setError(data?.error ?? "Could not save the profile");
      return;
    }
    setEditing(null);
    load();
  }

  async function remove(p: Profile) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await fetch(`/api/profiles/${p.id}`, { method: "DELETE" });
    load();
  }

  if (editing) {
    const isNew = editing === "new";
    return (
      <>
        <PageHeader
          title={isNew ? "New brand profile" : `Edit “${(editing as Profile).name}”`}
          subtitle="Fields are optional except the name. Sample posts power the style analysis."
        />
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8 md:px-10">
          <Card className="flex flex-col gap-5">
            {/* Name + fields */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="p-name" className="text-sm font-medium">
                Profile name *
              </label>
              <input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={80}
                placeholder="e.g. FitBite Foods"
                className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
              />
            </div>

            {FIELDS.map((f) =>
              f.textarea ? (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <label htmlFor={`p-${f.key}`} className="text-sm font-medium">
                    {f.label}
                  </label>
                  <textarea
                    id={`p-${f.key}`}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    rows={3}
                    placeholder={f.placeholder}
                    className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
              ) : (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <label htmlFor={`p-${f.key}`} className="text-sm font-medium">
                    {f.label}
                  </label>
                  <input
                    id={`p-${f.key}`}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
                  />
                </div>
              )
            )}

            {/* Sample posts */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="p-samples" className="text-sm font-medium">
                {isNew ? "Sample posts" : "Add sample posts"}
              </label>
              <p className="text-xs text-text-faint">
                Paste one or more past posts. Separate multiple posts with a line
                containing only <code className="font-mono">---</code>. Text files
                can be pasted the same way.
              </p>
              <textarea
                id="p-samples"
                value={newSamples}
                onChange={(e) => setNewSamples(e.target.value)}
                rows={6}
                placeholder={"Your gym bag called. It wants something better than water.\nNew FitBite protein drink — 20g protein, zero added sugar. Link in bio.\n---\nAnother sample post here…"}
                className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs outline-none focus:border-accent"
              />
            </div>

            {/* Style analysis (edit mode, existing) */}
            {!isNew && (editing as Profile).styleAnalysis && (
              <StyleAnalysisCard analysis={(editing as Profile).styleAnalysis!} />
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <SecondaryButton type="button" onClick={() => setEditing(null)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton type="button" onClick={save} disabled={saving}>
                {saving ? "Saving…" : isNew ? "Create profile" : "Save changes"}
              </PrimaryButton>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Brand & Creator Profiles"
        subtitle="Saved brand voices that power personalized drafts."
      />
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8 md:px-10">
        <div className="flex justify-end">
          <PrimaryButton type="button" onClick={startNew}>
            <Plus size={16} aria-hidden /> New profile
          </PrimaryButton>
        </div>

        {profiles === null && (
          <p className="text-sm text-text-faint">Loading profiles…</p>
        )}

        {profiles !== null && profiles.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
            <FileText size={24} className="text-text-faint" aria-hidden />
            <p className="font-display font-semibold">No profiles yet</p>
            <p className="max-w-sm text-sm text-text-muted">
              Create your first brand voice profile, paste a few sample posts, and
              Draftly will infer its style characteristics.
            </p>
            <PrimaryButton type="button" onClick={startNew}>
              <Plus size={16} aria-hidden /> Create a profile
            </PrimaryButton>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {profiles?.map((p) => (
            <Card key={p.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display font-semibold">{p.name}</h2>
                  {p.niche && <p className="text-sm text-text-muted">{p.niche}</p>}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    aria-label={`Edit ${p.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text"
                  >
                    <Pencil size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    aria-label={`Delete ${p.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="accent">{p.samplePosts.length} samples</Badge>
                {p.tone && <Badge>{p.tone}</Badge>}
                {p.platforms && <Badge>{p.platforms}</Badge>}
              </div>

              {p.styleAnalysis && <StyleAnalysisCard analysis={p.styleAnalysis} />}
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}

const ANALYSIS_ROWS: Array<{ key: keyof StyleAnalysis; label: string }> = [
  { key: "formality", label: "Formality" },
  { key: "humor", label: "Humor" },
  { key: "sentenceLength", label: "Sentence length" },
  { key: "emojiUsage", label: "Emoji usage" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "promotionalIntensity", label: "Promotional intensity" },
  { key: "storytelling", label: "Storytelling" },
];

function StyleAnalysisCard({ analysis }: { analysis: StyleAnalysis }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<Record<string, string>>({});

  return (
    <div className="rounded-lg border border-line bg-surface-2 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-accent" aria-hidden />
          <span className="text-sm font-medium">Detected style</span>
          <Badge>{analysis.sampleCount} posts analyzed</Badge>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-xs text-text-muted hover:text-text"
        >
          {open ? "Hide" : "Show details"}
        </button>
      </div>

      {!open && (
        <p className="mt-2 text-xs text-text-muted">
          {analysis.formality} tone · {analysis.sentenceLength} sentences ·{" "}
          {analysis.emojiUsage === "none" ? "no" : analysis.emojiUsage} emoji ·{" "}
          {analysis.storytelling} storytelling
        </p>
      )}

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {ANALYSIS_ROWS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3 text-sm">
              <span className="w-40 shrink-0 text-text-faint">{label}</span>
              {hidden[key] !== undefined ? (
                <input
                  value={hidden[key]}
                  onChange={(e) => setHidden({ ...hidden, [key]: e.target.value })}
                  className="h-7 flex-1 rounded-md border border-line bg-surface px-2 text-xs outline-none focus:border-accent"
                  aria-label={`Override ${label}`}
                />
              ) : (
                <span className="capitalize text-text-muted">
                  {String(analysis[key])}
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  setHidden((h) => {
                    if (h[key] !== undefined) {
                      const rest = { ...h };
                      delete rest[key];
                      return rest;
                    }
                    return { ...h, [key]: String(analysis[key]) };
                  })
                }
                className="text-xs text-accent hover:text-accent-strong"
              >
                {hidden[key] !== undefined ? "Use inference" : "Edit"}
              </button>
            </div>
          ))}

          {analysis.commonHooks.length > 0 && (
            <div className="flex flex-col gap-1 text-sm">
              <span className="w-40 shrink-0 text-text-faint">Common hooks</span>
              <ul className="flex flex-col gap-1 text-text-muted">
                {analysis.commonHooks.map((h) => (
                  <li key={h} className="truncate">
                    “{h}”
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 text-sm">
            <span className="w-40 shrink-0 text-text-faint">CTA style</span>
            <span className="text-text-muted">{analysis.ctaStyle}</span>
          </div>

          <p className="mt-1 text-xs text-text-faint">
            Detected characteristics are heuristic inferences from your samples —
            not AI model output. Edit any value to override it; overrides are used
            when generating content.
          </p>
        </div>
      )}
    </div>
  );
}
