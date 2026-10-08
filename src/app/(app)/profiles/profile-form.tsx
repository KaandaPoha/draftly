import Link from "next/link";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";
import { createProfile, updateProfile } from "./actions";

/**
 * Shared server-rendered profile form. Used by /profiles/new (create) and
 * /profiles/[id]/edit (update). Everything is plain HTML — no client JS.
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

const FIELDS: Array<{
  key: keyof ProfileFormValues;
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8 md:px-10">
      <Card className="flex flex-col gap-5">
        <form action={isNew ? createProfile : updateProfile} className="contents">
          {!isNew && profileId && (
            <input type="hidden" name="id" value={profileId} />
          )}

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

          {FIELDS.map((f) =>
            f.textarea ? (
              <div key={f.key} className="flex flex-col gap-1.5">
                <label htmlFor={`p-${f.key}`} className="text-sm font-medium">
                  {f.label}
                </label>
                <textarea
                  id={`p-${f.key}`}
                  name={f.key}
                  defaultValue={values[f.key]}
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
                  name={f.key}
                  defaultValue={values[f.key]}
                  placeholder={f.placeholder}
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
                />
              </div>
            )
          )}

          {/* Sample posts */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="p-samples" className="text-sm font-medium">
              {isNew ? "Sample posts" : "Add more sample posts"}
            </label>
            <p className="text-xs text-text-faint">
              Paste one or more past posts. Separate multiple posts with a line
              containing only <code className="font-mono">---</code>. Adding
              samples re-runs the style analysis.
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
