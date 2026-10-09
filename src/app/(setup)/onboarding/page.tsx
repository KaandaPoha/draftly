import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { selectRole, selectGoals, selectPlatforms, savePreferences } from "./actions";
import { ROLES, ROLE_HINTS, GOALS, PLATFORMS, LANGUAGES, TONES } from "@/lib/onboarding-options";
import { cn } from "@/lib/utils";

/**
 * Onboarding wizard — works entirely without JavaScript.
 * Steps are plain forms; every option is a native submit button or
 * checkbox. Progress travels in the URL so refresh/back behave sanely.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const step = Math.min(3, Math.max(0, parseInt(String(sp.step ?? "0"), 10) || 0));
  const errorKey = sp.error ? String(sp.error) : null;

  const role = sp.role ? String(sp.role) : "";
  const goals = sp.goals ? String(sp.goals).split(",").filter(Boolean) : [];
  const platforms = sp.platforms ? String(sp.platforms).split(",").filter(Boolean) : [];

  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12 md:py-16">
      {/* Progress */}
      <ol className="mb-8 flex items-center gap-2" aria-label="Onboarding progress">
        {["Who you are", "Your goals", "Your platforms", "Language & tone"].map(
          (label, i) => (
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
          )
        )}
      </ol>

      {/* Step 0 — role */}
      {step === 0 && (
        <div className="rounded-xl border border-line bg-surface p-6 md:p-8">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Who are you, {firstName}?
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            This shapes what Draftly recommends for you.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {ROLES.map((r) => (
              <form key={r} action={selectRole} className="contents">
                <button
                  type="submit"
                  className="group rounded-xl border border-line bg-surface-2 px-4 py-3 text-left transition-colors hover:border-accent"
                >
                  <span className="block text-sm font-medium text-text">{r}</span>
                  <span className="mt-0.5 block text-xs text-text-faint group-hover:text-text-muted">
                    {ROLE_HINTS[r]}
                  </span>
                </button>
                <input type="hidden" name="role" value={r} />
              </form>
            ))}
          </div>
        </div>
      )}

      {/* Step 1 — goals */}
      {step === 1 && (
        <div className="rounded-xl border border-line bg-surface p-6 md:p-8">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            What do you want to achieve?
          </h1>
          <p className="mt-1 text-sm text-text-muted">Pick all that apply.</p>
          {errorKey === "goals" && (
            <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              Choose at least one goal.
            </p>
          )}
          <form action={selectGoals} className="mt-6 flex flex-col gap-5">
            <input type="hidden" name="role" value={role} />
            <div className="flex flex-wrap gap-3">
              {GOALS.map((g) => (
                <label
                  key={g}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-text-muted has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent"
                >
                  <input type="checkbox" name="goals" value={g} className="accent-[var(--accent)]" />
                  {g}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <a
                href={`/onboarding?step=0`}
                className="rounded-lg px-3 py-2 text-sm text-text-muted hover:text-text"
              >
                Back
              </a>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-background transition-colors hover:bg-accent-strong"
              >
                Continue →
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 2 — platforms */}
      {step === 2 && (
        <div className="rounded-xl border border-line bg-surface p-6 md:p-8">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Which platforms do you use?
          </h1>
          <p className="mt-1 text-sm text-text-muted">Pick all that apply.</p>
          {errorKey === "platforms" && (
            <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              Choose at least one platform.
            </p>
          )}
          <form action={selectPlatforms} className="mt-6 flex flex-col gap-5">
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="goals" value={goals.join(",")} />
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map((p) => (
                <label
                  key={p}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-text-muted has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent"
                >
                  <input type="checkbox" name="platforms" value={p} className="accent-[var(--accent)]" />
                  {p}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <a
                href={`/onboarding?step=1&role=${encodeURIComponent(role)}`}
                className="rounded-lg px-3 py-2 text-sm text-text-muted hover:text-text"
              >
                Back
              </a>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-background transition-colors hover:bg-accent-strong"
              >
                Continue →
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 3 — language & tone + finish */}
      {step === 3 && (
        <div className="rounded-xl border border-line bg-surface p-6 md:p-8">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Language & tone
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Last step — you can change these any time in Settings.
          </p>
          {errorKey === "finish" && (
            <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              Choose a language and a tone to finish.
            </p>
          )}
          <form action={savePreferences} className="mt-6 flex flex-col gap-6">
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="goals" value={goals.join(",")} />
            <input type="hidden" name="platforms" value={platforms.join(",")} />

            <fieldset>
              <legend className="text-sm font-medium">Preferred language</legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {LANGUAGES.map((l) => (
                  <label
                    key={l}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-text-muted has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent"
                  >
                    <input
                      type="radio"
                      name="language"
                      value={l}
                      defaultChecked={l === "English"}
                      className="accent-[var(--accent)]"
                    />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium">Preferred tone</legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {TONES.map((t) => (
                  <label
                    key={t}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-text-muted has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent"
                  >
                    <input type="radio" name="tone" value={t} className="accent-[var(--accent)]" />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex items-center justify-between">
              <a
                href={`/onboarding?step=2&role=${encodeURIComponent(role)}&goals=${encodeURIComponent(goals.join(","))}`}
                className="rounded-lg px-3 py-2 text-sm text-text-muted hover:text-text"
              >
                Back
              </a>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-background transition-colors hover:bg-accent-strong"
              >
                Finish ✓
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
