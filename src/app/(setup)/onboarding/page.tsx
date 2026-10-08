"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = [
  "Influencer / Creator",
  "Brand / Business",
  "Startup",
  "Small Business",
  "Personal Brand",
  "Individual / Student",
  "Other",
];

const GOALS = [
  "Increase reach",
  "Increase engagement",
  "Grow followers",
  "Build brand awareness",
  "Launch a product",
  "Generate leads",
  "Increase sales",
  "Publish consistently",
];

const PLATFORMS = ["Instagram", "LinkedIn", "YouTube", "Facebook", "X"];

const LANGUAGES = ["English", "Hindi", "Hinglish", "Spanish", "German", "Other"];

const TONES = [
  "Friendly & casual",
  "Professional & formal",
  "Bold & punchy",
  "Warm & storytelling",
  "Witty & playful",
  "Minimal & direct",
];

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition-colors",
        selected
          ? "border-accent bg-accent-soft text-accent font-medium"
          : "border-line bg-surface-2 text-text-muted hover:text-text"
      )}
    >
      {children}
    </button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [language, setLanguage] = useState("English");
  const [tone, setTone] = useState<string | null>(null);

  const steps = ["Who you are", "Your goals", "Your platforms", "Language & tone"];
  const totalSteps = steps.length;

  function toggle(list: string[], setList: (v: string[]) => void, item: string) {
    setList(
      list.includes(item) ? list.filter((v) => v !== item) : [...list, item]
    );
  }

  async function finish() {
    setError(null);
    setSaving(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, goals, platforms, language, tone }),
    }).catch(() => null);
    setSaving(false);

    if (!res || !res.ok) {
      const data = res ? await res.json().catch(() => null) : null;
      setError(data?.error ?? "Could not save — please try again.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  const canContinue =
    (step === 0 && role) ||
    (step === 1 && goals.length > 0) ||
    (step === 2 && platforms.length > 0) ||
    step === 3;

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-12 md:py-20">
      {/* Progress */}
      <ol className="mb-10 flex items-center gap-2" aria-label="Onboarding progress">
        {steps.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <span
              className={cn(
                "h-1 rounded-full",
                i < step ? "bg-success" : i === step ? "bg-accent" : "bg-line"
              )}
            />
            <span
              className={cn(
                "text-xs",
                i === step ? "font-medium text-text" : "text-text-faint"
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-line bg-surface p-6 md:p-8">
        {step === 0 && (
          <>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              Who are you?
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              This shapes what Draftly recommends for you.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <Chip key={r} selected={role === r} onClick={() => setRole(r)}>
                  {r}
                </Chip>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              What do you want to achieve?
            </h1>
            <p className="mt-1 text-sm text-text-muted">Pick all that apply.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <Chip
                  key={g}
                  selected={goals.includes(g)}
                  onClick={() => toggle(goals, setGoals, g)}
                >
                  {g}
                </Chip>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              Which platforms do you use?
            </h1>
            <p className="mt-1 text-sm text-text-muted">Pick all that apply.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <Chip
                  key={p}
                  selected={platforms.includes(p)}
                  onClick={() => toggle(platforms, setPlatforms, p)}
                >
                  {p}
                </Chip>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              Language & tone
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              You can change these any time in Settings.
            </p>

            <fieldset className="mt-6">
              <legend className="text-sm font-medium">Preferred language</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {LANGUAGES.map((l) => (
                  <Chip key={l} selected={language === l} onClick={() => setLanguage(l)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-6">
              <legend className="text-sm font-medium">Preferred tone</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <Chip key={t} selected={tone === t} onClick={() => setTone(t)}>
                    {t}
                  </Chip>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {/* Controls */}
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-text-muted hover:text-text disabled:opacity-40"
          >
            <ArrowLeft size={16} aria-hidden /> Back
          </button>

          {step < totalSteps - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canContinue}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-background transition-colors hover:bg-accent-strong disabled:opacity-50"
            >
              Continue <ArrowRight size={16} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={!tone || saving}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-background transition-colors hover:bg-accent-strong disabled:opacity-50"
            >
              {saving ? (
                "Saving…"
              ) : (
                <>
                  Finish <Check size={16} aria-hidden />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
