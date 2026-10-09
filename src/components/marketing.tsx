import Link from "next/link";
import {
  Sparkles,
  PenLine,
  Users,
  Target,
  BarChart3,
  ArrowRight,
  CalendarDays,
  MessageSquare,
  Check,
} from "lucide-react";

/**
 * Public marketing landing page for signed-out visitors.
 *
 * Before this page existed, a new visitor hitting the site saw a bare login
 * wall — no explanation of what Draftly is or why to sign up. This page
 * explains the product in three plain steps and links to signup/login.
 * Signed-in users never see it: the root page redirects them to the dashboard.
 *
 * Fully server-rendered: no client JS needed.
 */

const STEPS = [
  {
    icon: Users,
    title: "Tell Draftly who you are",
    body:
      "Create a brand voice profile — your tone, your audience, words you love and avoid. Paste a few past posts and Draftly learns your style.",
  },
  {
    icon: Target,
    title: "Describe your idea",
    body:
      "One sentence is enough. Pick the platform, the goal, and the format — Draftly shapes the draft to each platform's rules.",
  },
  {
    icon: Sparkles,
    title: "Get drafts that sound like you",
    body:
      "Every draft is structured — hook, caption, hashtags, CTA — with a plain-language explanation of why it was written that way.",
  },
];

const FEATURES = [
  {
    icon: PenLine,
    title: "Create Content",
    body: "Guided studio with hooks, captions, scripts, carousels, and visual concepts.",
  },
  {
    icon: BarChart3,
    title: "Draft quality review",
    body: "Hook clarity, readability, and CTA strength — with concrete fixes.",
  },
  {
    icon: MessageSquare,
    title: "AI assistant",
    body: "Strategy chat that knows your profiles and drafts — brainstorm, refine, adapt.",
  },
  {
    icon: CalendarDays,
    title: "Planner & campaigns",
    body: "Campaign folders, a content calendar, and posting windows as honest estimates.",
  },
];

export function MarketingLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-20 px-5 py-10 md:px-10 md:py-16">
      {/* Hero */}
      <section className="flex flex-col items-start gap-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-text-muted">
          <Sparkles size={13} className="text-accent" aria-hidden />
          AI content studio for brands & creators
        </span>
        <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          Content that sounds like{" "}
          <span className="bg-gradient-to-r from-accent to-electric bg-clip-text text-transparent">
            you
          </span>
          , not like everyone else&rsquo;s AI.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-text-muted">
          Most tools generate generic captions. Draftly learns your brand voice,
          studies your audience, and produces platform-ready drafts — then
          explains every choice so you stay in control.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={signedIn ? "/create" : "/signup"}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-background transition-colors hover:bg-accent-strong"
          >
            {signedIn ? "Open Draftly" : "Create free account"}
            <ArrowRight size={16} aria-hidden />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-lg border border-line bg-surface px-5 text-sm font-medium text-text transition-colors hover:border-accent"
          >
            I already have an account
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-it-works" className="flex flex-col gap-8">
        <h2 id="how-it-works" className="font-display text-2xl font-semibold tracking-tight">
          How Draftly works
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-xl border border-line bg-surface p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <s.icon size={17} aria-hidden />
                </span>
                <span className="text-xs font-medium text-text-faint">
                  STEP {i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section aria-labelledby="features" className="flex flex-col gap-8">
        <h2 id="features" className="font-display text-2xl font-semibold tracking-tight">
          Everything in one studio
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4 rounded-xl border border-line bg-surface p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <f.icon size={17} aria-hidden />
              </span>
              <div>
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Honesty section */}
      <section
        aria-labelledby="honesty"
        className="rounded-xl border border-line bg-surface p-6 md:p-8"
      >
        <h2 id="honesty" className="font-display text-xl font-semibold tracking-tight">
          Honest by design
        </h2>
        <ul className="mt-4 flex flex-col gap-3 text-sm text-text-muted">
          {[
            "Nothing is labelled “AI” unless it genuinely came from the provider — fallbacks say so.",
            "Posting-time suggestions are estimates, never fabricated analytics.",
            "Your API key stays server-side; your data is private to your account.",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <Check size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* Footer CTA */}
      <section className="flex flex-col items-center gap-4 rounded-xl border border-line bg-gradient-to-br from-accent-soft via-surface to-surface p-8 text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Ready to sound like yourself?
        </h2>
        <p className="max-w-md text-sm text-text-muted">
          Free to try. Set up your brand voice once — every draft after that is
          faster, on-brand, and explained.
        </p>
        <Link
          href={signedIn ? "/create" : "/signup"}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-background transition-colors hover:bg-accent-strong"
        >
          {signedIn ? "Start creating" : "Create free account"}
          <ArrowRight size={16} aria-hidden />
        </Link>
      </section>
    </div>
  );
}
