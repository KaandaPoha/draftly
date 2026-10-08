import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, PrimaryButton } from "@/components/ui";
import { VoiceInput } from "@/components/voice";
import { advance, back, generate } from "./actions";
import type { ReactNode } from "react";

// Reads the session cookie and the database — render per-request.
export const instant = false;

function hidden(state: Record<string, string>, exclude: string[] = []): ReactNode {
  return Object.entries(state)
    .filter(([k]) => !exclude.includes(k))
    .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
}

/**
 * Create Studio — fully server-rendered wizard.
 * All state lives in query params; every control is a native form control,
 * so it works with or without client-side JavaScript.
 */

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
  { value: "post", label: "Full post draft" },
  { value: "reel", label: "Reel — script + storyboard" },
  { value: "video_script", label: "Video script" },
  { value: "animation", label: "Animation concept" },
  { value: "carousel", label: "Carousel outline" },
  { value: "image_concept", label: "Image / visual concept" },
  { value: "headline", label: "Headline" },
  { value: "cta_only", label: "Call to action" },
];

const STEP_NAMES = ["Idea", "Profile", "Audience", "Platform", "Goal", "Format"];

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const state = {
    step: String(sp.step ?? "0"),
    idea: String(sp.idea ?? ""),
    profileId: String(sp.profileId ?? ""),
    audienceAge: String(sp.audienceAge ?? ""),
    audienceLocation: String(sp.audienceLocation ?? ""),
    audienceInterests: String(sp.audienceInterests ?? ""),
    platform: String(sp.platform ?? "Instagram"),
    goal: String(sp.goal ?? "Awareness"),
    format: String(sp.format ?? "captions"),
    variant: String(sp.variant ?? "0"),
  };
  const step = Math.min(5, Math.max(0, parseInt(state.step, 10) || 0));
  const error = sp.error ? String(sp.error) : null;

  const profiles = await prisma.brandProfile.findMany({
    where: { userId: user.id, isTemporary: false },
    select: { id: true, name: true, tone: true },
  });

  return (
    <>
      <PageHeader
        title="Create Content"
        subtitle="Describe your idea and Draftly builds a structured draft using your selected brand voice."
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8 md:px-10">
        {/* Step chips */}
        <ol className="flex flex-wrap gap-2" aria-label="Workflow steps">
          {STEP_NAMES.map((label, i) => (
            <li key={label}>
              <span
                className={
                  step === i
                    ? "rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
                    : "rounded-full bg-surface-2 px-3 py-1 text-xs text-text-faint"
                }
              >
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>

        {error === "idea" && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            Describe your idea first (at least a few words).
          </p>
        )}

        {/* Step 0 — idea */}
        {step === 0 && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">What do you want to create?</h2>
            <p className="text-sm text-text-muted">
              Anything you want to launch, promote, announce, or explain — a
              sentence is enough.
            </p>
            <form action={advance} className="flex flex-col gap-4">
              {hidden(state, ["idea"])}
              <textarea
                id="idea-input"
                name="idea"
                rows={4}
                required
                minLength={3}
                maxLength={2000}
                defaultValue={state.idea}
                placeholder='e.g. "We are launching a new chocolate drink for college students."'
                className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <VoiceInput targetId="idea-input" label="Dictate your idea" />
              <div className="flex justify-end">
                <PrimaryButton type="submit">Continue →</PrimaryButton>
              </div>
            </form>
          </Card>
        )}

        {/* Step 1 — profile */}
        {step === 1 && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">Use a brand voice profile?</h2>
            <p className="text-sm text-text-muted">
              A profile shapes tone, vocabulary, and audience focus. Without one,
              the draft stays generic.
            </p>
            <form action={advance} className="flex flex-col gap-5">
              {hidden(state, ["profileId"])}
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="profileId"
                    value=""
                    defaultChecked={state.profileId === ""}
                    className="peer sr-only"
                  />
                  <span className="block rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-text-muted peer-has-checked:border-accent peer-has-checked:bg-accent-soft peer-has-checked:text-accent">
                    No profile (generic)
                  </span>
                </label>
                {profiles.map((p) => (
                  <label key={p.id} className="cursor-pointer">
                    <input
                      type="radio"
                      name="profileId"
                      value={p.id}
                      defaultChecked={state.profileId === p.id}
                      className="peer sr-only"
                    />
                    <span className="block rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-text-muted peer-has-checked:border-accent peer-has-checked:bg-accent-soft peer-has-checked:text-accent">
                      {p.name}
                      {p.tone ? ` · ${p.tone}` : ""}
                    </span>
                  </label>
                ))}
              </div>
              {profiles.length === 0 && (
                <p className="text-xs text-text-faint">
                  You have no saved profiles yet —{" "}
                  <Link href="/profiles" className="text-accent">create one</Link>{" "}
                  to personalize drafts.
                </p>
              )}
              <div className="flex items-center justify-between">
                <BackForm state={state} step={step} />
                <PrimaryButton type="submit">Continue →</PrimaryButton>
              </div>
            </form>
          </Card>
        )}

        {/* Step 2 — audience */}
        {step === 2 && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">Who is this for?</h2>
            <p className="text-sm text-text-muted">
              Optional — but specific details make the draft relevant. Draftly
              never assumes demographics without your input.
            </p>
            <form action={advance} className="flex flex-col gap-4">
              {hidden(state, ["audienceAge", "audienceLocation", "audienceInterests"])}
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5 text-sm">
                  Age range
                  <input
                    name="audienceAge"
                    defaultValue={state.audienceAge}
                    placeholder="e.g. 18–24"
                    className="h-10 rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  Location
                  <input
                    name="audienceLocation"
                    defaultValue={state.audienceLocation}
                    placeholder="e.g. India, metros"
                    className="h-10 rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  Interests
                  <input
                    name="audienceInterests"
                    defaultValue={state.audienceInterests}
                    placeholder="e.g. fitness, hostel life"
                    className="h-10 rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-accent"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between">
                <BackForm state={state} step={step} />
                <PrimaryButton type="submit">Continue →</PrimaryButton>
              </div>
            </form>
          </Card>
        )}

        {/* Step 3 — platform */}
        {step === 3 && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">Which platform?</h2>
            <form action={advance} className="flex flex-col gap-5">
              {hidden(state, ["platform"])}
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <label key={p} className="cursor-pointer">
                    <input
                      type="radio"
                      name="platform"
                      value={p}
                      defaultChecked={state.platform === p}
                      className="peer sr-only"
                    />
                    <span className="block rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-text-muted peer-has-checked:border-accent peer-has-checked:bg-accent-soft peer-has-checked:text-accent">
                      {p}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <BackForm state={state} step={step} />
                <PrimaryButton type="submit">Continue →</PrimaryButton>
              </div>
            </form>
          </Card>
        )}

        {/* Step 4 — goal */}
        {step === 4 && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">What&rsquo;s the goal?</h2>
            <form action={advance} className="flex flex-col gap-5">
              {hidden(state, ["goal"])}
              <div className="flex flex-wrap gap-2">
                {GOALS.map((g) => (
                  <label key={g} className="cursor-pointer">
                    <input
                      type="radio"
                      name="goal"
                      value={g}
                      defaultChecked={state.goal === g}
                      className="peer sr-only"
                    />
                    <span className="block rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-text-muted peer-has-checked:border-accent peer-has-checked:bg-accent-soft peer-has-checked:text-accent">
                      {g}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <BackForm state={state} step={step} />
                <PrimaryButton type="submit">Continue →</PrimaryButton>
              </div>
            </form>
          </Card>
        )}

        {/* Step 5 — format + generate */}
        {step === 5 && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">Pick a format</h2>
            <form action={generate} className="flex flex-col gap-5">
              {hidden(state, ["format"])}
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <label key={f.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value={f.value}
                      defaultChecked={state.format === f.value}
                      className="peer sr-only"
                    />
                    <span className="block rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-text-muted peer-has-checked:border-accent peer-has-checked:bg-accent-soft peer-has-checked:text-accent">
                      {f.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <BackForm state={state} step={step} />
                <PrimaryButton type="submit">
                  ✨ Generate draft
                </PrimaryButton>
              </div>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}

function BackForm({ state, step }: { state: Record<string, string>; step: number }) {
  return (
    <form action={back}>
      {hidden({ ...state, step: String(step) })}
      <button
        type="submit"
        className="rounded-lg px-3 py-2 text-sm text-text-muted hover:text-text"
      >
        ← Back
      </button>
    </form>
  );
}
