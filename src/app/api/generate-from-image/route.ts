/**
 * POST /api/generate-from-image
 *
 * Accepts a multipart form (image file + selections), validates the image
 * server-side, and runs image-based generation through the existing Gemini
 * (OpenAI-compatible) pipeline. Saves via the existing draft persistence.
 *
 * Honesty rule: a failed model call is reported as an error with no fake
 * draft — the UI shows it and offers a retry. Metadata is recorded on the
 * draft so the status card can say truthfully that the content was generated
 * from an image, and with what.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateContentFromImage } from "@/lib/ai";
import { validateImage, toDataUrl, MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from "@/lib/image-input";

const selectionsSchema = z.object({
  instructions: z
    .string()
    .trim()
    .min(3, "Describe what you want — even one line is enough")
    .max(2000),
  platform: z.string().trim().min(1).max(40),
  goal: z.string().trim().min(1).max(100),
  format: z.enum([
    "captions",
    "hooks",
    "hashtags",
    "video_script",
    "carousel",
    "image_concept",
    "headline",
    "cta_only",
    "post",
    "reel",
    "animation",
    "story",
    "blog",
    "email",
    "other",
  ]),
  audience: z.string().trim().max(500).optional().nullable(),
  tone: z.string().trim().max(80).optional().nullable(),
  language: z.string().trim().max(60).optional().nullable(),
  profileId: z.string().optional().nullable(),
});

/** 6 MB body cap: the 5 MB image plus form fields, with headroom. */
export const bodySizeLimit = MAX_IMAGE_BYTES + 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not read the upload. Try again with a smaller image." },
      { status: 400 }
    );
  }

  const file = form.get("image");
  const rawSelections = form.get("selections");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose an image to continue." }, { status: 400 });
  }

  const parsed = selectionsSchema.safeParse(
    rawSelections ? JSON.parse(String(rawSelections)) : null
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid selections" },
      { status: 400 }
    );
  }
  const selections = parsed.data;

  // Early declared-type rejection before reading bytes.
  const declared = (file.type || "").toLowerCase();
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(declared)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a JPEG, PNG, or WebP image." },
      { status: 415 }
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      {
        error: `That image is ${Math.round((file.size / (1024 * 1024)) * 10) / 10} MB — the limit is 5 MB. Try a smaller version.`,
      },
      { status: 413 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateImage({ declaredType: declared, bytes });
  if (!validation.ok) {
    const status = validation.error.includes("limit") ? 413 : 415;
    return NextResponse.json({ error: validation.error }, { status });
  }

  // Profile must belong to the user.
  let profile = null;
  if (selections.profileId) {
    profile = await prisma.brandProfile.findFirst({
      where: { id: selections.profileId, userId: user.id },
    });
  }

  const voice = profile
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
    : null;

  // The fallback generator still needs an `idea`. Derive it from the user's
  // instructions — it is only ever used for structural defaults if the model
  // omits a field, and the draft is always labelled with the real mode.
  const idea = selections.instructions.slice(0, 500);

  const result = await generateContentFromImage({
    selections: {
      idea,
      profile: voice,
      audience: selections.audience ?? null,
      platform: selections.platform,
      goal: selections.goal,
      format: selections.format,
      variant: 0,
      tone: selections.tone || profile?.tone || "natural",
      language: selections.language || profile?.language || "English",
      instructions: selections.instructions,
    },
    imageDataUrl: toDataUrl(bytes, validation.mimeType),
    imageMeta: { mimeType: validation.mimeType, bytes: validation.bytes },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, canRetry: result.canRetry },
      // 502: upstream provider failure, not the client's mistake.
      { status: result.canRetry ? 502 : 400 }
    );
  }

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
      platform: selections.platform,
      goal: selections.goal,
      format: selections.format,
      audience: selections.audience ?? null,
      idea,
      variant: 0,
      isPersonalized: Boolean(profile),
      status: "draft",
      // generationMode stays "llm": the draft is model output. The image
      // provenance is recorded separately so the status card can show
      // "generated from an image · {model}" truthfully.
      generationMode: "llm",
      model: result.model,
      // Image provenance metadata only — never the image bytes.
      sourceImage: `${result.imageMeta.mimeType}:${result.imageMeta.bytes}`,
      storyboard: JSON.stringify(draft.storyboard),
      imagePrompt: JSON.stringify(draft.artboard),
      designSpec: JSON.stringify(draft.design),
    },
  });

  return NextResponse.json({
    draftId: created.id,
    draft,
    model: result.model,
    imageMeta: result.imageMeta,
  });
}
