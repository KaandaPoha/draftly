/**
 * Multimodal provider transport tests — completeWithImage in src/lib/llm.ts
 *
 * The real HTTP code path is exercised against a locally mocked fetch: these
 * tests prove the image data URL is placed in the request body in the exact
 * shape the OpenAI-compatible endpoint (Gemini's included) expects, that text
 * instructions arrive alongside it, and that provider failures surface as the
 * same typed LlmErrors text generation throws.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mockFetch, withEnv } from "./helpers/mock-fetch.ts";
import { completeWithImage, LlmError } from "../src/lib/llm.ts";

const OPENAI_ENV = {
  AI_PROVIDER: "openai",
  AI_API_KEY: "test-key-image",
  AI_MODEL: "test-vision-model",
  AI_BASE_URL: "http://llm.test/v1",
};

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const OPENAI_OK = (content: string) =>
  JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  });

describe("completeWithImage (lib/llm.ts)", () => {
  let mock: ReturnType<typeof mockFetch> | null = null;
  afterEach(() => {
    mock?.restore();
    mock = null;
  });

  it("sends the image as an image_url content part and the text beside it", async () => {
    await withEnv(OPENAI_ENV, async () => {
      const m = mockFetch(() => ({ status: 200, body: OPENAI_OK('{"title":"x"}') }));
      try {
        const out = await completeWithImage("be a strategist", "describe this", PNG_DATA_URL);
        assert.equal(out, '{"title":"x"}');

        assert.equal(m.log.length, 1);
        const body = m.log[0].body as {
          model: string;
          messages: Array<{
            role: string;
            content: unknown;
          }>;
        };
        assert.equal(body.model, "test-vision-model");
        assert.equal(body.messages[0].role, "system");
        assert.equal(body.messages[0].content, "be a strategist");
        assert.equal(body.messages[1].role, "user");

        const parts = body.messages[1].content as Array<{
          type: string;
          text?: string;
          image_url?: { url: string };
        }>;
        assert.equal(parts[0].type, "text");
        assert.equal(parts[0].text, "describe this");
        assert.equal(parts[1].type, "image_url");
        assert.equal(parts[1].image_url?.url, PNG_DATA_URL);
        // The authorization header carries the key — and is never in the body.
        assert.equal(m.log[0].headers.authorization, "Bearer test-key-image");
      } finally {
        m.restore();
      }
    });
  });

  it("throws not_configured without a provider key — never fakes image understanding", async () => {
    await withEnv({ AI_API_KEY: undefined }, async () => {
      await assert.rejects(
        () => completeWithImage("s", "t", PNG_DATA_URL),
        (err: LlmError) => err.code === "not_configured"
      );
    });
  });

  it("maps a 429 to rate_limit and a 401 to auth", async () => {
    await withEnv(OPENAI_ENV, async () => {
      const m = mockFetch(() => ({ status: 429, body: "too many" }));
      try {
        await assert.rejects(
          () => completeWithImage("s", "t", PNG_DATA_URL),
          (err: LlmError) => err.code === "rate_limit"
        );
      } finally {
        m.restore();
      }

      const m2 = mockFetch(() => ({ status: 401, body: "nope" }));
      try {
        await assert.rejects(
          () => completeWithImage("s", "t", PNG_DATA_URL),
          (err: LlmError) => err.code === "auth"
        );
      } finally {
        m2.restore();
      }
    });
  });

  it("rejects a truncated reply instead of parsing half a draft", async () => {
    await withEnv(OPENAI_ENV, async () => {
      const m = mockFetch(() =>
        // finish_reason "length" means the model ran out of tokens mid-JSON.
        ({
          status: 200,
          body: JSON.stringify({
            choices: [{ index: 0, message: { role: "assistant", content: '{"title":"cut' }, finish_reason: "length" }],
          }),
        })
      );
      try {
        await assert.rejects(() => completeWithImage("s", "t", PNG_DATA_URL), LlmError);
      } finally {
        m.restore();
      }
    });
  });
});
