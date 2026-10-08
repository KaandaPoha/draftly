import Link from "next/link";
import { redirect } from "next/navigation";
import { Image as ImageIcon, Info } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, PrimaryButton, Badge, DropdownField } from "@/components/ui";
import { ImagePicker } from "@/components/image-picker";
import { aiConfigured } from "@/lib/ai";
import { MAX_IMAGE_BYTES } from "@/lib/image-input";
import { PLATFORMS, GOALS, FORMATS, TONES, LANGUAGES } from "@/lib/form-options";
import { generateFromImageAction } from "./actions";

export const instant = false;

export default async function ImageToContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const notice = typeof sp.notice === "string" ? sp.notice : null;

  const configured = aiConfigured();

  const profiles = await prisma.brandProfile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Create content from image"
        subtitle="Upload a photo, tell Draftly what you want, and get platform-ready copy built on what the image actually shows."
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-8 md:px-10">
        {/* Honesty banner — the feature genuinely requires a vision model. */}
        {!configured && (
          <Card className="border-warning/40">
            <p className="text-sm text-warning">
              No AI provider is configured, so image understanding is
              unavailable. This page needs AI_API_KEY in Settings — Draftly
              will not pretend a built-in generator saw your image.
            </p>
          </Card>
        )}

        {notice && (
          <Card className="border-success/40">
            <p className="text-sm text-success">{notice}</p>
          </Card>
        )}

        <form action={generateFromImageAction} className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <ImageIcon size={16} className="text-accent" aria-hidden />
              <h2 className="font-display font-semibold">Your image</h2>
              <Badge tone="neutral">JPEG · PNG · WebP · max 5 MB</Badge>
            </div>
            <ImagePicker maxBytes={MAX_IMAGE_BYTES} />
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">What Draftly should create</h2>

            <label className="flex flex-col gap-1 text-xs text-text-faint">
              Extra instructions (what to do with the image)
              <textarea
                name="instructions"
                required
                rows={3}
                maxLength={2000}
                placeholder="e.g. Write a launch caption for this product photo — make it funny, target college students, focus on the benefits."
                className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DropdownField
                label="Platform"
                name="platform"
                options={PLATFORMS}
              />
              <DropdownField
                label="Content format"
                name="format"
                options={FORMATS}
              />
              <DropdownField label="Content goal" name="goal" options={GOALS} />
              <DropdownField label="Tone" name="tone" options={TONES} />
              <DropdownField label="Language" name="language" options={LANGUAGES} />
              <label className="flex flex-col gap-1 text-xs text-text-faint">
                Brand voice (optional)
                <select
                  name="profileId"
                  className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm text-text"
                >
                  <option value="">No brand voice — write neutrally</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs text-text-faint">
              Audience (optional — describe who this is for)
              <input
                type="text"
                name="audience"
                maxLength={500}
                placeholder="e.g. college students in metros who hit the gym"
                className="h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent"
              />
            </label>
          </Card>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}{" "}
              <span className="text-text-faint">
                Press Generate again once the issue is fixed — your image and
                other selections are kept.
              </span>
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <Link href="/create" className="text-sm text-text-muted hover:text-text">
              ← Text-only studio
            </Link>
            <PrimaryButton type="submit" disabled={!configured}>
              ✨ Generate from image
            </PrimaryButton>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-text-faint">
            <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
            Your image is sent to the AI provider to read, and is not stored by
            Draftly. Generation usually takes 10–30 seconds.
          </p>
        </form>
      </div>
    </>
  );
}
