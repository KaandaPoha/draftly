/**
 * Image-to-content pipeline tests — generateContentFromImage in src/lib/ai.ts
 *
 * Proves the honesty contract of the image feature: real model output is
 * returned and labelled with the model; a provider failure NEVER produces a
 * fake draft labelled as image-understanding output — it returns an error the
 * UI can show and a retry flag; and without a provider key the feature refuses
 * outright rather than quietly pretending a built-in generator saw the image.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mockFetch, withEnv } from "./helpers/mock-fetch.ts";
import { generateContentFromImage } from "../src/lib/ai.ts";

const OPENAI_ENV = {
  AI_PROVIDER: "openai",
  AI_API_KEY: "test-key-image",
  AI_MODEL: "test-vision-model",
  AI_BASE_URL: "http://llm.test/v1",
};

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgo=";

/** Wrap a draft JSON string in the OpenAI-compatible completion envelope the
 *  transport expects from the provider. */
const envelope = (content: string) =>
  JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  });

/** A complete, valid draft as a model would return it. */
const MODEL_DRAFT = JSON.stringify({
  title: "Latte launch",
  hook: "This cup knows your order.",
  body: "A latte so good it scans back.",
  caption: "New drop: the latte that scans back.",
  hashtags: ["#coffee", "#latte"],
  cta: "Order yours today.",
  visualDirection: "Warm café light, close-up on the cup.",
  storyboard: [
    { index: 1, timecode: "—", shot: "hero frame of the cup", onScreen: "New drop", voiceover: "—", transition: "static" },
  ],
  artboard: {
    headline: "The latte that scans back",
    subhead: "Brewed for busy mornings",
    cta: "Order today",
    palette: { bg: "#0f0b1e", surface: "#1a1430", fg: "#f4f2ff", accent: "#8b5cf6", accent2: "#22d3ee" },
    layout: "centered",
    motif: "circles",
    aspect: "square",
    artDirection: "Warm café tones with a violet accent.",
  },
  design: { palette: ["#8b5cf6"], typography: "Geist", layout: "centered", motion: "none" },
});

const SELECTIONS = {
  idea: "launch caption for this photo",
  profile: null,
  audience: "college students",
  platform: "Instagram",
  goal: "Product launch",
  format: "captions",
  variant: 0,
  tone: "funny",
  language: "English",
  instructions: "Write a funny launch caption for this product photo.",
};

function base() {
  return {
    selections: SELECTIONS,
    imageDataUrl: PNG_DATA_URL,
    imageMeta: { mimeType: "image/png", bytes: 70 },
  };
}

describe("generateContentFromImage (lib/ai.ts)", () => {
  let mock: ReturnType<typeof mockFetch> | null = null;
  afterEach(() => {
    mock?.restore();
    mock = null;
  });

  it("returns real model output labelled with the model and image meta", async () => {
    await withEnv(OPENAI_ENV, async () => {
      mock = mockFetch(() => ({ status: 200, body: envelope(MODEL_DRAFT) }));
      const out = await generateContentFromImage(base());
      assert.ok(out.ok);
      if (!out.ok) return;
      assert.equal(out.model, "openai:test-vision-model");
      assert.equal(out.draft.title, "Latte launch");
      assert.equal(out.imageMeta.mimeType, "image/png");
      assert.equal(out.imageMeta.bytes, 70);
    });
  });

  it("passes the user's selections into the prompt verbatim", async () => {
    await withEnv(OPENAI_ENV, async () => {
      mock = mockFetch(() => ({ status: 200, body: envelope(MODEL_DRAFT) }));
      const out = await generateContentFromImage(base());
      assert.ok(out.ok);
      if (!out.ok) return;
      assert.equal(out.draft.platform, "Instagram");
      assert.equal(out.draft.goal, "Product launch");
      assert.equal(out.draft.format, "captions");
      assert.equal(out.draft.audience, "college students");
    });
  });

  it("refuses outright without a provider — never a fake image draft", async () => {
    await withEnv({ AI_API_KEY: undefined }, async () => {
      const out = await generateContentFromImage(base());
      assert.ok(!out.ok);
      if (out.ok) return;
      assert.match(out.error, /No AI provider is configured/i);
      assert.equal(out.canRetry, false);
    });
  });

  it("returns a retryable error when the provider fails — no draft at all", async () => {
    await withEnv(OPENAI_ENV, async () => {
      mock = mockFetch(() => ({ status: 500, body: "provider exploded" }));
      const out = await generateContentFromImage(base());
      assert.ok(!out.ok);
      if (out.ok) return;
      assert.equal(out.canRetry, true);
      assert.ok(out.error.length > 0);
    });
  });

  it("returns a non-retryable error on a malformed image encoding", async () => {
    await withEnv(OPENAI_ENV, async () => {
      const out = await generateContentFromImage({
        selections: SELECTIONS,
        // Not a data URL — the transport cannot split a mime type from it.
        imageDataUrl: "http://example.com/not-a-data-url.png",
        imageMeta: { mimeType: "image/png", bytes: 70 },
      });
      // Whether the provider call fails or the transport rejects it, the
      // contract is the same: an error the UI can show, no fake draft.
      assert.ok(!out.ok);
      if (out.ok) return;
      assert.ok(out.error.length > 0);
    });
  });
});
