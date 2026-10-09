import Link from "next/link";
import {
  Card,
  PrimaryButton,
  SecondaryButton,
  SuggestField,
} from "@/components/ui";
import { createProfile, updateProfile } from "./actions";

/**
 * Shared server-rendered profile form. Used by /profiles/new (create) and
 * /profiles/[id]/edit (update). Everything is plain HTML — no client JS.
 *
 * Only the profile name is required; the other fields live in a collapsible
 * "Optional details" section (native <details>) so creating a profile never
 * feels like filling in a 12-field wall. Free-text fields get a native
 * <datalist> of one-click suggestions while still accepting any input.
 */

export type ProfileFormValues = {
  name: string;
  description: string;
  niche: string;
  offerings: string;
  audience: string;
  platforms: string;
  language: string;
  tone: string;
  wordsToUse: string;
  wordsToAvoid: string;
  guidelines: string;
  colors: string;
};

export const EMPTY_PROFILE: ProfileFormValues = {
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

/** Suggestion sets — click to fill, or type anything else. */
const NICHE_IDEAS = [
  "Health food & beverages",
  "Fitness & coaching",
  "Skincare & beauty",
  "Fashion & clothing",
  "Education & edtech",
  "SaaS & software",
  "Travel & hospitality",
  "Personal finance",
  "Handmade / crafts",
  "Food & restaurant",
];
const PLATFORM_IDEAS = ["Instagram", "LinkedIn", "YouTube", "Facebook", "X"];
const LANGUAGE_IDEAS = ["English", "Hindi", "Hinglish", "Spanish", "German"];
const TONE_IDEAS = [
  "Friendly & casual",
  "Professional & formal",
  "Bold & punchy",
  "Warm & storytelling",
  "Witty & playful",
  "Minimal & direct",
];
const WORDS_IDEAS = ["clean ingredients", "no added sugar", "trainer-approved"];

const FIELDS: Array<{
  key: keyof ProfileFormValues;
  label: string;
  placeholder: string;
  hint: string;
  suggestions?: readonly string[];
}> = [
  {
    key: "description",
    label: "What does this brand do?",
    placeholder: "e.g. We make protein drinks for busy students",
    hint: "One or two lines is plenty — Draftly uses this to keep every draft on-topic.",
  },
  {
    key: "niche",
    label: "Industry / niche",
    placeholder: "Pick a suggestion or type your own",
    hint: "Helps Draftly match the right examples and hashtags.",
    suggestions: NICHE_IDEAS,
  },
  {
    key: "offerings",
    label: "Products or services",
    placeholder: "What do you sell or offer?",
    hint: "Only if it should be mentioned in content — you can leave this out.",
  },
  {
    key: "audience",
    label: "Who is the content for?",
    placeholder: "e.g. college students who lift",
    hint: "Describe them in your own words — age, interests, whatever matters.",
  },
  {
    key: "platforms",
    label: "Where will you post?",
    placeholder: "Pick a suggestion or type your own",
    hint: "Comma separated. Draftly shapes each draft to the platform you pick here.",
    suggestions: PLATFORM_IDEAS,
  },
  {
    key: "language",
    label: "Language",
    placeholder: "Pick a suggestion or type your own",
    hint: "Drafts are written in this language.",
    suggestions: LANGUAGE_IDEAS,
  },
  {
    key: "tone",
    label: "Tone",
    placeholder: "Pick a suggestion or type your own",
    hint: "How the writing should feel. Friendly & casual suits most brands.",
    suggestions: TONE_IDEAS,
  },
];

const EXTRA_FIELDS: Array<{
  key: keyof ProfileFormValues;
  label: string;
  placeholder: string;
  hint: string;
  suggestions?: readonly string[];
}> = [
  {
    key: "wordsToUse",
    label: "Words to use",
    placeholder: "Comma separated — pick a suggestion or type your own",
    hint: "Signature phrases that make your posts recognizable.",
    suggestions: WORDS_IDEAS,
  },
  {
    key: "wordsToAvoid",
    label: "Words to avoid",
    placeholder: "Comma separated — pick a suggestion or type your own",
    hint: "Anything that feels off-brand — hype words, jargon, competitor names.",
  },
  {
    key: "guidelines",
    label: "Brand guidelines",
    placeholder: "Anything the content must respect",
    hint: "Optional. Claim rules, things never to mention, must-have disclaimers.",
  },
  {
    key: "colors",
    label: "Colors / visual preferences",
    placeholder: "e.g. warm orange + off-white",
    hint: "Optional — guides visual concepts only.",
  },
];

  /** One form field with its label, optional <datalist>, and help line. */
function Field({
  f,
  values,
}: {
  f: (typeof FIELDS)[number];
  values: ProfileFormValues;
}) {
  return (
    <SuggestField
      label={f.label}
      name={f.key}
      suggestions={f.suggestions ?? []}
      placeholder={f.placeholder}
      hint={f.hint}
      textarea={f.key === "description"}
      defaultValue={values[f.key]}
    />
  );
}

export function ProfileForm({
  mode,
  profileId,
  values,
  error,
}: {
  mode: "create" | "edit";
  profileId?: string;
  values: ProfileFormValues;
  error?: string | null;
}) {
  const isNew = mode === "create";
  const hasOptionalContent = EXTRA_FIELDS.some((f) => values[f.key]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8 md:px-10">
      {/* Reassurance: only one field is truly required. */}
      <p className="rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-xs text-text-muted">
        Only the profile name is required. Everything else is optional — add it
        now or any time later. {hasOptionalContent && "Existing values are kept."}
      </p>

      <Card className="flex flex-col gap-5">
        <form action={isNew ? createProfile : updateProfile} className="contents">
          {!isNew && profileId && (
            <input type="hidden" name="id" value={profileId} />
          )}

          {/* Required: just the name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="p-name" className="text-sm font-medium">
              Profile name *
            </label>
            <input
              id="p-name"
              name="name"
              defaultValue={values.name}
              required
              maxLength={80}
              placeholder="e.g. FitBite Foods"
              className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
            />
          </div>

          {/* Core voice fields, each with a plain-language hint */}
          {FIELDS.map((f) => (
            <Field key={f.key} f={f} values={values} />
          ))}

          {/* Optional extras, collapsed by default on create */}
          <details
            className="rounded-lg border border-line bg-surface-2"
            open={hasOptionalContent}
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-text-muted hover:text-text [&::-webkit-details-marker]:hidden">
              Optional details{" "}
              <span className="font-normal text-text-faint">
                (words to use/avoid, guidelines, colors — all optional)
              </span>
            </summary>
            <div className="flex flex-col gap-5 border-t border-line px-4 py-4">
              {EXTRA_FIELDS.map((f) => (
                <Field key={f.key} f={f} values={values} />
              ))}
            </div>
          </details>

          {/* Sample posts */}
          <details className="rounded-lg border border-line bg-surface-2">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-text-muted hover:text-text [&::-webkit-details-marker]:hidden">
              Sample posts{" "}
              <span className="font-normal text-text-faint">
                — optional, but they make drafts sound like you
              </span>
            </summary>
            <div className="flex flex-col gap-2 border-t border-line px-4 py-4">
              <label htmlFor="p-samples" className="text-xs text-text-faint">
                {isNew ? "Paste one or more past posts" : "Add more sample posts"}
              </label>
              <p className="text-[11px] leading-relaxed text-text-faint">
                Separate multiple posts with a line containing only{" "}
                <code className="font-mono">---</code>. Adding samples re-runs
                the style analysis — the more you add, the closer drafts match
                your voice.
              </p>
              <textarea
                id="p-samples"
                name="samples"
                rows={6}
                placeholder={
                  "Your gym bag called. It wants something better than water.\nNew FitBite protein drink — 20g protein, zero added sugar. Link in bio.\n---\nAnother sample post here…"
                }
                className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs outline-none focus:border-accent"
              />
            </div>
          </details>

          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <Link href={isNew ? "/profiles" : `/profiles/${profileId}`}>
              <SecondaryButton type="button">Cancel</SecondaryButton>
            </Link>
            <PrimaryButton type="submit">
              {isNew ? "Create profile" : "Save changes"}
            </PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
