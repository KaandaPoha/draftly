/**
 * Provider transport tests — src/lib/llm.ts
 *
 * The transport reads its endpoint and key from environment variables, so the
 * real HTTP code path is exercised against a locally mocked `fetch`. No
 * external service is contacted and no API key is required.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mockFetch, withEnv } from "./helpers/mock-fetch.ts";
import { LlmError, extractJson, complete, testConnection } from "../src/lib/llm.ts";

const OPENAI_ENV = {
  AI_PROVIDER: "openai",
  AI_API_KEY: "test-key-123",
  AI_MODEL: "test-model",
  AI_BASE_URL: "http://llm.test/v1",
};

/** Default env for tests that need a provider configured. */
function withProvider(fn: () => void | Promise<void>) {
  return withEnv(OPENAI_ENV, fn);
}

/** Env guaranteed to have no provider key, for demo-mode assertions. */
function withoutProvider(fn: () => void | Promise<void>) {
  return withEnv(
    { AI_API_KEY: undefined, AI_PROVIDER: undefined, AI_MODEL: undefined, AI_BASE_URL: undefined },
    fn
  );
}

/** A minimal valid OpenAI-compatible completion body. */
const OPENAI_OK = (content: string) =>
  JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  });

describe("provider transport (lib/llm.ts)", () => {
  let mock: ReturnType<typeof mockFetch> | null = null;

  const install = (respond: Parameters<typeof mockFetch>[0]) => {
    mock = mockFetch(respond);
  };

  afterEach(() => {
    mock?.restore();
    mock = null;
  });

  it("posts to the OpenAI-compatible chat completions endpoint with Bearer auth", async () => {
    await withProvider(async () => {
      install(() => ({ status: 200, body: OPENAI_OK("hello") }));

      const out = await complete("be a strategist", "write a caption");
      assert.equal(out, "hello");

      // The mock reads the request body asynchronously, so inspect the log      // after the call has settled rather than capturing a live reference.
      const m = mock!;
      assert.equal(m.log.length, 1);
      const sent = m.log[0];
      assert.equal(sent.url, "http://llm.test/v1/chat/completions");
      assert.equal(sent.method, "POST");
      assert.equal(sent.headers.authorization, "Bearer test-key-123");
      const body = sent.body as {
        model: string;
        max_tokens: number;
        messages: Array<{ role: string; content: string }>;
      };
      assert.equal(body.model, "test-model");
      assert.equal(body.max_tokens, 2000);
      assert.deepEqual(
        body.messages.map((msg) => msg.role),
        ["system", "user"]
      );
      assert.equal(body.messages[0].content, "be a strategist");
      assert.equal(body.messages[1].content, "write a caption");
    });
  });

  it("requests JSON response format when asked", async () => {
    await withProvider(async () => {
      install(() => ({ status: 200, body: OPENAI_OK("{}") }));
      await complete("sys", "user", { json: true });
      const body = mock!.log[0].body as { response_format?: { type: string } } | null;
      assert.equal(body?.response_format?.type, "json_object");
    });
  });

  it("parses the Anthropic Messages response shape", async () => {
    await withEnv(
      { ...OPENAI_ENV, AI_PROVIDER: "anthropic", AI_BASE_URL: "http://llm.test/v1" },
      async () => {
        install(() => ({
          status: 200,
          body: JSON.stringify({
            content: [
              { type: "text", text: "part one " },
              { type: "tool_use", id: "x" }, // non-text block must be filtered
              { type: "text", text: "part two" },
            ],
          }),
        }));

        const out = await complete("sys", "user");
        assert.equal(out, "part one \npart two");

        const sent = mock!.log[0];
        assert.ok(sent.url.endsWith("/messages"), `expected /messages, got ${sent.url}`);
        assert.equal(sent.headers["x-api-key"], "test-key-123");
        assert.equal(sent.headers["anthropic-version"], "2023-06-01");
        assert.equal(sent.headers.authorization, undefined, "Anthropic must not use Bearer auth");
      }
    );
  });

  it("authentication failure throws an auth LlmError with a useful message and no key", async () => {
    await withProvider(async () => {
      install(() => ({
        status: 401,
        body: JSON.stringify({ error: { message: "bad key" } }),
      }));

      await assert.rejects(complete("s", "u"), (err: LlmError) => {
        assert.ok(err instanceof LlmError);
        assert.equal(err.code, "auth");
        // The friendly message never contains the key.
        assert.ok(!err.friendly.includes("test-key-123"));
        // The raw message carries only the (harmless) provider body.
        assert.ok(err.message.includes("Auth failed"));
        return true;
      });
    });
  });

  it("authentication failure surfaces a useful message through testConnection", async () => {
    await withProvider(async () => {
      install(() => ({ status: 403, body: "forbidden" }));
      const result = await testConnection();
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.match(result.error, /rejected the API key/i);
        assert.ok(!result.error.includes("test-key-123"), "must not echo the key");
      }
    });
  });

  it("rate limiting is classified separately from auth", async () => {
    await withProvider(async () => {
      install(() => ({ status: 429, body: "slow down" }));
      await assert.rejects(complete("s", "u"), (err: LlmError) => {
        assert.equal(err.code, "rate_limit");
        assert.match(err.friendly, /rate-limit/i);
        return true;
      });
    });
  });

  it("a RESOURCE_EXHAUSTED 429 is classified as quota, not rate_limit", async () => {
    await withProvider(async () => {
      install(() => ({
        status: 429,
        body: JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" } }),
      }));
      await assert.rejects(complete("s", "u"), (err: LlmError) => {
        assert.equal(err.code, "quota");
        // The friendly text must not tell the user to retry immediately.
        assert.doesNotMatch(err.friendly, /rate-limit/i);
        assert.match(err.friendly, /RESOURCE_EXHAUSTED|quota/i);
        return true;
      });
    });
  });

  it("a plain 429 without RESOURCE_EXHAUSTED stays rate_limit (retryable)", async () => {
    await withProvider(async () => {
      install(() => ({ status: 429, body: JSON.stringify({ error: "slow down" }) }));
      await assert.rejects(complete("s", "u"), (err: LlmError) => {
        assert.equal(err.code, "rate_limit");
        return true;
      });
    });
  });

  it("non-JSON provider output fails safely as bad_response", async () => {
    await withProvider(async () => {
      install(() => ({ status: 200, body: "<html>gateway error</html>" }));
      await assert.rejects(complete("s", "u"), (err: LlmError) => {
        assert.equal(err.code, "bad_response");
        assert.match(err.message, /non-JSON/i);
        return true;
      });
    });
  });

  it("a 200 response with an empty message fails safely", async () => {
    await withProvider(async () => {
      install(() => ({ status: 200, body: OPENAI_OK("") }));
      await assert.rejects(complete("s", "u"), (err: LlmError) => {
        assert.equal(err.code, "bad_response");
        assert.match(err.message, /empty/i);
        return true;
      });
    });
  });

  it("network failure is classified as network, not bad_response", async () => {
    await withProvider(async () => {
      install(() => ({ throws: new Error("ECONNREFUSED") }));
      await assert.rejects(complete("s", "u"), (err: LlmError) => {
        assert.equal(err.code, "network");
        return true;
      });
    });
  });

  it("timeout is classified as timeout", async () => {
    await withProvider(async () => {
      install(() => {
        const e = new Error("aborted");
        e.name = "AbortError";
        return { throws: e };
      });
      await assert.rejects(complete("s", "u"), (err: LlmError) => {
        assert.equal(err.code, "timeout");
        return true;
      });
    });
  });

  it("no API key is reported as not_configured without any network call", async () => {
    await withoutProvider(async () => {
      let called = false;
      install(() => {
        called = true;
        return { status: 500, body: "should not be reached" };
      });
      await assert.rejects(complete("s", "u"), (err: LlmError) => {
        assert.equal(err.code, "not_configured");
        return true;
      });
      assert.equal(called, false, "no request should be made without a key");
    });
  });

  describe("extractJson", () => {
    it("parses a bare JSON object", () => {
      assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
    });

    it("parses JSON wrapped in a fenced block", () => {
      assert.deepEqual(extractJson('```json\n{"a":"b"}\n```'), { a: "b" });
    });

    it("parses JSON embedded in prose", () => {
      assert.deepEqual(extractJson('Here you go: {"ok":true} — enjoy'), { ok: true });
    });

    it("parses nested objects without being confused by braces in strings", () => {
      assert.deepEqual(extractJson('prefix {"a":{"b":"} {"},"c":[1,2]}'), {
        a: { b: "} {" },
        c: [1, 2],
      });
    });

    it("throws a bad_response LlmError on unparseable output", () => {
      assert.throws(() => extractJson("no json at all"), (err: LlmError) => {
        assert.equal(err.code, "bad_response");
        return true;
      });
    });
  });

  describe("Gemini via the OpenAI-compatible endpoint", () => {
    /**
     * Gemini exposes an OpenAI-compatible /chat/completions API, so it is
     * reached with the SAME adapter — just different settings. The
     * GEMINI_ENV values are the ones documented in .env.example; they must
     * flow through to the existing transport unchanged.
     */
    const GEMINI_ENV: Record<string, string> = {
      AI_PROVIDER: "openai",
      AI_API_KEY: "test-key-123",
      AI_MODEL: "gemini-3.8-flash",
      AI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
    };

    it("routes Gemini settings through the existing openai adapter", async () => {
      await withEnv(GEMINI_ENV, async () => {
        install(() => ({ status: 200, body: OPENAI_OK("gemini says hi") }));

        const out = await complete("system", "user");
        assert.equal(out, "gemini says hi");

        const req = mock!.log[0];
        assert.equal(
          req.url,
          "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          "the base URL must get /chat/completions appended"
        );
        assert.equal(req.method, "POST");
        assert.equal(req.headers.authorization, "Bearer test-key-123");
        assert.equal((req.body as { model?: string }).model, "gemini-3.8-flash");
      });
    });

    it("keeps demo mode when no credentials are set, regardless of provider", async () => {
      await withEnv({ ...GEMINI_ENV, AI_API_KEY: undefined }, async () => {
        install(() => {
          throw new Error("network must not be reached without a key");
        });
        await assert.rejects(complete("s", "u"), (err: LlmError) => {
          assert.equal(err.code, "not_configured");
          return true;
        });
      });
    });

    it("propagates Gemini auth failures as a useful, key-free error", async () => {
      await withEnv(GEMINI_ENV, async () => {
        install(() => ({
          status: 401,
          body: JSON.stringify({ error: { message: "API key not valid" } }),
        }));

        await assert.rejects(complete("s", "u"), (err: LlmError) => {
          assert.equal(err.code, "auth");
          assert.ok(!String(err.message).includes("test-key-123"), "no key leak");
          assert.ok(!String(err.friendly ?? "").includes("test-key-123"), "no key leak (friendly)");
          return true;
        });
      });
    });

    it("raises a clear error when the provider truncates the reply (finish_reason=length)", async () => {
      await withProvider(async () => {
        // Simulate a max_tokens cut-off: valid JSON envelope, unfinished text.
        install(() => ({
          status: 200,
          body: JSON.stringify({
            choices: [
              {
                message: { role: "assistant", content: '{"title": "unfinis' },
                finish_reason: "length",
              },
            ],
          }),
        }));

        await assert.rejects(complete("s", "u"), (err: LlmError) => {
          assert.equal(err.code, "bad_response");
          assert.match(err.friendly ?? "", /cut short|could not read/i);
          return true;
        });
      });
    });

    it("accepts a complete reply whose finish_reason is stop", async () => {
      await withProvider(async () => {
        install(() => ({ status: 200, body: OPENAI_OK('{"title":"ok"}') }));
        assert.equal(await complete("s", "u"), '{"title":"ok"}');
      });
    });
  });
});
