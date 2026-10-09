"use server";

/**
 * Image-to-content server action.
 *
 * Receives the multipart form (image file + selections), validates the image
 * server-side, calls the existing Gemini pipeline via completeWithImage, saves
 * through the existing draft persistence, and redirects to the draft page.
 *
 * On failure it redirects back to /create/image with a readable ?error=
 * message — the form keeps nothing (that is the cost of no-JS), so the error
 * text tells the user what to fix and they retry with a fresh image. That is
 * honest: nothing pretends to have succeeded.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateContentFromImage } from "@/lib/ai";
import { submitToken, once } from "@/lib/submit-guard";
import { validateImage, toDataUrl, MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from "@/lib/image-input";
import { PLATFORMS, GOALS, FORMATS } from "@/lib/form-options";

const FORMAT_VALUES = FORMATS.map((f) => f.value) as readonly string[];

/** The format keys the generation pipeline knows (mirrors the API schemas). */
type FormatKey =
  | "captions"
  | "hooks"
  | "hashtags"
  | "video_script"
  | "carousel"
  | "image_concept"
  | "headline"
  | "cta_only"
  | "post"
  | "reel"
  | "animation"
  | "story"
  | "blog"
  | "email"
  | "other";

function fail(error: string): never {
  redirect(`/create/image?error=${encodeURIComponent(error)}`);
}

export async function generateFromImageAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    fail("Choose an image to continue.");
  }

  // Server-side validation — the browser's checks are a courtesy only.
  const declared = (file.type || "").toLowerCase();
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(declared)) {
    fail("Unsupported file type. Upload a JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    fail(
      `That image is ${Math.round((file.size / (1024 * 1024)) * 10) / 10} MB — the limit is 5 MB. Try a smaller version.`
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateImage({ declaredType: declared, bytes });
  if (!validation.ok) fail(validation.error);

  /* ---- selections ---- */
  const instructions = String(formData.get("instructions") ?? "").trim();
  if (instructions.length < 3) {
    fail("Describe what you want — even one line is enough.");
  }
  if (instructions.length > 2000) {
    fail("Instructions are too long (max 2000 characters).");
  }

  const platform = String(formData.get("platform") ?? "").trim();
  if (!(PLATFORMS as readonly string[]).includes(platform)) {
    fail("Choose a platform from the list.");
  }

  const format = String(formData.get("format") ?? "").trim();
  if (!FORMAT_VALUES.includes(format)) {
    fail("Choose a content format from the list.");
  }
  const formatKey = format as FormatKey;

  const goal = String(formData.get("goal") ?? "").trim();
  if (!(GOALS as readonly string[]).includes(goal)) {
    fail("Choose a content goal from the list.");
  }

  const audience = String(formData.get("audience") ?? "").trim().slice(0, 500) || null;
  const tone = String(formData.get("tone") ?? "").trim().slice(0, 80) || null;
  const language = String(formData.get("language") ?? "").trim().slice(0, 60) || null;
  const profileId = String(formData.get("profileId") ?? "").trim() || null;

  // Profile must belong to the user.
  let profile = null;
  if (profileId) {
    profile = await prisma.brandProfile.findFirst({
      where: { id: profileId, userId: user.id },
    });
  }

  // A rapid double click must not generate and save twice (same guard as the
  // text wizard — each run is a real provider call).
  const token = submitToken("create-image-generate", `${user.id}|${instructions}|${platform}|${format}|${goal}`);
  if (!once(token)) {
    redirect(`/create/image?error=${encodeURIComponent("A generation with these details just ran. Wait for it to finish or change something before retrying.")}`);
  }

  const result = await generateContentFromImage({
    selections: {
      // The fallback generator still needs an `idea`; it is only used for
      // structural defaults if the model omits a field, and the resulting
      // draft is always labelled with the real generation mode.
      idea: instructions.slice(0, 500),
      profile: profile
        ? {
            name: profile.name,
            tone: profile.tone,
            language: profile.language,
            wordsToUse: profile.wordsToUse,
            wordsToAvoid: profile.wordsToAvoid,
            audience: profile.audience,
            niche: profile.niche,
            offerings: profile.offerings,
            colors: profile.colors,
            guidelines: profile.guidelines,
            description: profile.description,
            styleAnalysis: profile.styleAnalysis,
          }
        : null,
      audience,
      platform,
      goal,
      format: formatKey,
      variant: 0,
      tone: tone || profile?.tone || "natural",
      language: language || profile?.language || "English",
      instructions,
    },
    imageDataUrl: toDataUrl(bytes, validation.mimeType),
    imageMeta: { mimeType: validation.mimeType, bytes: validation.bytes },
  });

  if (!result.ok) {
    fail(result.error);
  }
  // The guard stays consumed on failure so a genuine retry (new window or a
  // changed payload) is never mistaken for a double submit.

  // Persist through the existing draft system. The uploaded image itself is
  // NOT written to disk — nothing about the upload survives the request
  // except the generated draft, which is the user's own content.
  const draft = result.draft;
  const created = await prisma.contentDraft.create({
    data: {
      userId: user.id,
      profileId: profile?.id ?? null,
      title: draft.title,
      hook: draft.hook,
      body: draft.body,
      caption: draft.caption,
      hashtags: draft.hashtags.join(", "),
      cta: draft.cta,
      visualNotes: draft.visualDirection,
      platform,
      goal,
      format: formatKey,
      audience,
      idea: instructions.slice(0, 500),
      variant: 0,
      isPersonalized: Boolean(profile),
      status: "draft",
      // generationMode stays "llm": the draft is model output. The image
      // provenance is recorded separately (below) so the status card can say
      // truthfully that the content was generated from an image.
      generationMode: "llm",
      model: result.model,
      // Image provenance metadata only — never the image bytes.
      sourceImage: `${result.imageMeta.mimeType}:${result.imageMeta.bytes}`,
      storyboard: JSON.stringify(draft.storyboard),
      imagePrompt: JSON.stringify(draft.artboard),
      designSpec: JSON.stringify(draft.design),
    },
  });

  redirect(`/drafts/${created.id}?notice=${encodeURIComponent("Draft generated from your image.")}`);
}
