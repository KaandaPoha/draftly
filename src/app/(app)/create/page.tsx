"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles, RotateCcw, Copy, Check } from "lucide-react";
import { PageHeader, Card, Badge, PrimaryButton, SecondaryButton } from "@/components/ui";
import { cn } from "@/lib/utils";

type Profile = { id: string; name: string; tone: string | null };

type Draft = {
  title: string;
  hook: string;
  body: string;
  caption: string;
  hashtags: string[];
  cta: string;
  visualDirection: string;
  platform: string;
  goal: string;
  format: string;
  audience: string | null;
};

const PLATFORMS = ["Instagram", "LinkedIn", "YouTube", "Facebook", "X"];

const GOALS = [
  "Awareness",
  "Engagement",
  "Followers",
  "Education",
  "Leads",
  "Sales",
  "Product launch",
];

const FORMATS = [
  { value: "captions", label: "Caption" },
  { value: "hooks", label: "Hooks" },
  { value: "hashtags", label: "Hashtags" },
  { value: "video_script", label: "Video / Reel script" },
  { value: "carousel", label: "Carousel outline" },
  { value: "image_concept", label: "Image / visual concept" },
  { value: "headline", label: "Headline" },
  { value: "cta_only", label: "Call to action" },
  { value: "post", label: "Full post draft" },
];

function Chips({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: Array<{ value: string; label: string }>;
  value: string | null;
  onChange: (v: string) => void;
  multi?: boolean;
}) {
  void multi;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-full border px-4 py-2 text-sm transition-colors",
            value === o.value
              ? "border-accent bg-accent-soft font-medium text-accent"
              : "border-line bg-surface-2 text-text-muted hover:text-text"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function CreatePage() {
  const [step, setStep] = useState(0);
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Inputs
  const [idea, setIdea] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [audienceAge, setAudienceAge] = useState("");
  const [audienceLocation, setAudienceLocation] = useState("");
  const [audienceInterests, setAudienceInterests] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [goal, setGoal] = useState("Awareness");
  const [format, setFormat] = useState("captions");

  // Results
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mode, setMode] = useState<"ai" | "demo">("demo");
  const [variant, setVariant] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);

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

  const selectedProfile = profiles?.find((p) => p.id === profileId) ?? null;

  async function generate(nextVariant: number) {
    setGenerating(true);
    setError(null);
    setSavedId(null);

    const audience = [audienceAge, audienceLocation, audienceInterests]
      .filter(Boolean)
      .join(" · ");

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea,
        profileId,
        audience: audience || null,
        platform,
        goal,
        format,
        variant: nextVariant,
      }),
    }).catch(() => null);
    setGenerating(false);

    if (!res || !res.ok) {
      const data = res ? await res.json().catch(() => null) : null;
      setError(data?.error ?? "Generation failed — please try again.");
      return;
    }

    const data = await res.json();
    setDraft(data.draft);
    setMode(data.mode);
    setVariant(nextVariant);
    setStep(6);
  }

  async function saveDraft() {
    if (!draft) return;
    const audience = [audienceAge, audienceLocation, audienceInterests]
      .filter(Boolean)
      .join(" · ");
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea,
        profileId,
        audience: audience || null,
        platform,
        goal,
        format,
        variant,
        save: true,
      }),
    }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      setSavedId(data.draftId);
    }
  }

  function copyAll() {
    if (!draft) return;
    const text = [
      draft.hook,
      "",
      draft.body,
      "",
      draft.caption,
      "",
      draft.hashtags.join(" "),
      "",
      draft.cta,
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const steps = ["Idea", "Profile", "Audience", "Platform", "Goal", "Format"];

  return (
    <>
      <PageHeader
        title="Create Content"
        subtitle="Describe your idea and Draftly builds a structured draft — using your selected brand voice."
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8 md:px-10">
        {/* Steps display */}
        <ol className="flex flex-wrap gap-2" aria-label="Workflow steps">
          {steps.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => i < 6 && setStep(i)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-colors",
                  step === i
                    ? "bg-accent-soft font-medium text-accent"
                    : "bg-surface-2 text-text-faint hover:text-text"
                )}
              >
                {i + 1}. {label}
              </button>
            </li>
          ))}
          {step === 6 && (
            <li className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
              Draft ready
            </li>
          )}
        </ol>

        {/* Step 0: idea */}
        {step === 0 && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">What do you want to create?</h2>
            <p className="text-sm text-text-muted">
              Anything you want to launch, promote, announce, or explain — a
              sentence is enough.
            </p>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder='e.g. "We are launching a new chocolate drink for college students."'
              className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex justify-end">
              <PrimaryButton
                type="button"
                onClick={() => setStep(1)}
                disabled={idea.trim().length < 3}
              >
                Continue <ArrowRight size={16} aria-hidden />
              </PrimaryButton>
            </div>
          </Card>
        )}

        {/* Step 1: profile */}
        {step === 1 && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">Use a brand voice profile?</h2>
            <p className="text-sm text-text-muted">
              A profile shapes tone, vocabulary, and audience focus. Without one,
              the draft stays generic — you can add profiles under Brand Profiles.
            </p>
            {profiles === null && <p className="text-sm text-text-faint">Loading…</p>}
            <div className="flex flex-wrap gap-2">
              {profiles?.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProfileId(profileId === p.id ? null : p.id)}
                  aria-pressed={profileId === p.id}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition-colors",
                    profileId === p.id
                      ? "border-accent bg-accent-soft font-medium text-accent"
                      : "border-line bg-surface-2 text-text-muted hover:text-text"
                  )}
                >
                  {p.name}
                  {p.tone ? ` · ${p.tone}` : ""}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <SecondaryButton type="button" onClick={() => setStep(0)}>
                <ArrowLeft size={16} aria-hidden /> Back
              </SecondaryButton>
              <PrimaryButton type="button" onClick={() => setStep(2)}>
                Continue <ArrowRight size={16} aria-hidden />
              </PrimaryButton>
            </div>
          </Card>
        )}

        {/* Step 2: audience */}
        {step === 2 && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">Who is this for?</h2>
            <p className="text-sm text-text-muted">
              Optional — but specific details make the draft relevant. Draftly
              never assumes demographics without your input.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-sm">
                Age range
                <input
                  value={audienceAge}
                  onChange={(e) => setAudienceAge(e.target.value)}
                  placeholder="e.g. 18–24"
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                Location
                <input
                  value={audienceLocation}
                  onChange={(e) => setAudienceLocation(e.target.value)}
                  placeholder="e.g. India, metros"
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                Interests
                <input
                  value={audienceInterests}
                  onChange={(e) => setAudienceInterests(e.target.value)}
                  placeholder="e.g. fitness, hostels life"
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-accent"
                />
              </label>
            </div>
            <div className="flex items-center justify-between">
              <SecondaryButton type="button" onClick={() => setStep(1)}>
                <ArrowLeft size={16} aria-hidden /> Back
              </SecondaryButton>
              <PrimaryButton type="button" onClick={() => setStep(3)}>
                Continue <ArrowRight size={16} aria-hidden />
              </PrimaryButton>
            </div>
          </Card>
        )}

        {/* Step 3: platform */}
        {step === 3 && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">Which platform?</h2>
            <Chips
              options={PLATFORMS.map((p) => ({ value: p, label: p }))}
              value={platform}
              onChange={setPlatform}
            />
            <div className="flex items-center justify-between">
              <SecondaryButton type="button" onClick={() => setStep(2)}>
                <ArrowLeft size={16} aria-hidden /> Back
              </SecondaryButton>
              <PrimaryButton type="button" onClick={() => setStep(4)}>
                Continue <ArrowRight size={16} aria-hidden />
              </PrimaryButton>
            </div>
          </Card>
        )}

        {/* Step 4: goal */}
        {step === 4 && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">What&apos;s the goal?</h2>
            <Chips
              options={GOALS.map((g) => ({ value: g, label: g }))}
              value={goal}
              onChange={setGoal}
            />
            <div className="flex items-center justify-between">
              <SecondaryButton type="button" onClick={() => setStep(3)}>
                <ArrowLeft size={16} aria-hidden /> Back
              </SecondaryButton>
              <PrimaryButton type="button" onClick={() => setStep(5)}>
                Continue <ArrowRight size={16} aria-hidden />
              </PrimaryButton>
            </div>
          </Card>
        )}

        {/* Step 5: format */}
        {step === 5 && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">Pick a format</h2>
            <Chips
              options={FORMATS}
              value={format}
              onChange={setFormat}
            />
            {error && (
              <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between">
              <SecondaryButton type="button" onClick={() => setStep(4)}>
                <ArrowLeft size={16} aria-hidden /> Back
              </SecondaryButton>
              <PrimaryButton
                type="button"
                onClick={() => generate(0)}
                disabled={generating}
              >
                {generating ? (
                  "Generating…"
                ) : (
                  <>
                    <Sparkles size={16} aria-hidden /> Generate draft
                  </>
                )}
              </PrimaryButton>
            </div>
          </Card>
        )}

        {/* Step 6: result */}
        {step === 6 && draft && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={selectedProfile ? "accent" : "warning"}>
                  {selectedProfile
                    ? `Personalized · ${selectedProfile.name}`
                    : "No profile — generic draft"}
                </Badge>
                <Badge tone={mode === "ai" ? "success" : "neutral"}>
                  {mode === "ai" ? "AI-generated" : "Demo generation"}
                </Badge>
                <Badge>{draft.platform}</Badge>
                <Badge>{draft.format.replace("_", " ")}</Badge>
              </div>
              <div className="flex gap-2">
                <SecondaryButton type="button" onClick={copyAll}>
                  {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                  {copied ? "Copied" : "Copy all"}
                </SecondaryButton>
                <SecondaryButton type="button" onClick={saveDraft} disabled={savedId !== null}>
                  {savedId ? "Saved ✓" : "Save draft"}
                </SecondaryButton>
              </div>
            </div>

            {mode === "demo" && (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
                Demo mode — this draft is assembled from templates that react to
                your inputs (no AI model is configured yet). Add an AI_API_KEY to
                enable real generation.
              </p>
            )}

            {savedId && (
              <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                Draft saved to your library.
              </p>
            )}

            <Card className="flex flex-col gap-5">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-text-faint">Title</span>
                <h2 className="mt-1 font-display font-semibold">{draft.title}</h2>
              </div>

              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-text-faint">Hook</span>
                <p className="mt-1 text-sm leading-relaxed">{draft.hook}</p>
              </div>

              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-text-faint">
                  {draft.format === "captions" ? "Caption" : "Content"}
                </span>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{draft.body}</p>
              </div>

              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-text-faint">Call to action</span>
                <p className="mt-1 text-sm leading-relaxed">{draft.cta}</p>
              </div>

              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-text-faint">Hashtags</span>
                <p className="mt-1 font-mono text-xs leading-relaxed text-accent2">
                  {draft.hashtags.join(" ")}
                </p>
              </div>

              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-text-faint">Visual direction</span>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">
                  {draft.visualDirection}
                </p>
              </div>

              <div className="border-t border-line pt-4">
                <span className="font-mono text-xs uppercase tracking-wider text-text-faint">
                  Context used
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge>Platform: {draft.platform}</Badge>
                  <Badge>Goal: {draft.goal}</Badge>
                  {draft.audience && <Badge>Audience: {draft.audience}</Badge>}
                  {selectedProfile && <Badge>Tone: {selectedProfile.tone ?? "default"}</Badge>}
                </div>
              </div>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <SecondaryButton
                type="button"
                onClick={() => setStep(0)}
              >
                <RotateCcw size={15} aria-hidden /> New draft
              </SecondaryButton>
              <PrimaryButton
                type="button"
                onClick={() => generate(variant + 1)}
                disabled={generating}
              >
                {generating ? "Generating…" : "Generate alternative"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
