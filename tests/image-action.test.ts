/**
 * Image server-action guard tests — the real generateFromImageAction from
 * src/app/(app)/create/image/actions.ts.
 *
 * Same resolver harness as the route tests, plus a fake for the AI boundary:
 * the action must never reach generation in the cases under test, and when it
 * does run, the stub answers without touching any provider.
 *
 * These tests prove, at the action level (no-JS form flow):
 *   - a rapid double submit is caught by the once() guard and redirects back
 *     with a readable error, with exactly one generation attempted;
 *   - the guard stays consumed when generation fails, so a retry is possible;
 *   - unsigned-in users are redirected to /login before anything else runs.
 *
 * No request leaves the process; the provider is never called.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

await register("./helpers/route-res.mjs", import.meta.url);

/* ---------- imports resolved through the hook ---------- */

const action = await import("../src/app/(app)/create/image/actions.ts");
const authStub = await import("./helpers/stub-auth.ts");
const prismaStub = await import("./helpers/stub-prisma.ts");
const aiStub = await import("./helpers/stub-ai.ts");
const guard = await import("../src/lib/submit-guard.ts");

/** Pull the redirect URL out of Next's digest-encoded error. */
function redirectUrl(err: unknown): string {
  assert.ok(err instanceof Error && "digest" in err, "expected a Next redirect throw");
  const digest = String(err.digest);
  assert.match(digest, /^NEXT_REDIRECT;/, "expected a NEXT_REDIRECT digest");
  return digest.split(";")[2];
}

/** Build the multipart form the no-JS wizard posts. */
function imageForm(overrides: Record<string, string> = {}): FormData {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const form = new FormData();
  form.set("image", new File([bytes], "tiny.png", { type: "image/png" }));
  form.set("instructions", "Launch post for our new chocolate drink");
  form.set("platform", "Instagram");
  form.set("format", "captions");
  form.set("goal", "Awareness");
  for (const [k, v] of Object.entries(overrides)) form.set(k, v);
  return form;
}

/** Run the action and capture its redirect instead of failing on the throw. */
async function runAction(form: FormData): Promise<string> {
  try {
    await action.generateFromImageAction(form);
  } catch (err) {
    return redirectUrl(err);
  }
  return ""; // no redirect — the action returned normally
}

describe("image generation server action (no-JS form flow)", () => {
  afterEach(() => {
    authStub.__reset();
    prismaStub.__reset();
    aiStub.__reset();
    guard.__reset();
  });

  it("redirects a signed-out visitor to /login before anything else", async () => {
    authStub.__setUser(null);
    const url = await runAction(imageForm());
    assert.equal(url, "/login");
    assert.equal(aiStub.__calls(), 0, "no generation is attempted");
    assert.equal(prismaStub.__lastCreate(), null, "nothing is saved");
  });

  it("a rapid double submit redirects with a readable error and generates once", async () => {
    authStub.__setUser({ id: "u1" });
    aiStub.__setResult({
      ok: true,
      draft: {
        title: "t", hook: "h", body: "b", caption: "c",
        hashtags: ["#x"], cta: "cta", visualDirection: "v",
        storyboard: {}, artboard: {}, design: {},
      },
      model: "openai:gemini-3.8-flash",
      imageMeta: { mimeType: "image/png", bytes: 11 },
    });

    const form = imageForm();
    const first = await runAction(form);
    assert.match(first, /^\/drafts\//, "the first submit succeeds and lands on the draft");
    assert.equal(aiStub.__calls(), 1, "exactly one generation ran");

    // Same payload again inside the guard window = a double click.
    const second = await runAction(form);
    assert.match(second, /^\/create\/image\?error=/, "the duplicate is sent back with an error");
    const message = decodeURIComponent(second.split("error=")[1] ?? "");
    assert.match(message, /just ran/i);
    assert.equal(aiStub.__calls(), 1, "no second generation is attempted");
    assert.equal(prismaStub.__lastCreate()?.idea, "Launch post for our new chocolate drink");
  });

  it("the guard stays consumed when generation fails, so a retry is possible", async () => {
    authStub.__setUser({ id: "u1" });
    aiStub.__setResult({ ok: false, error: "Provider failed — try again.", canRetry: true });

    const form = imageForm();
    const first = await runAction(form);
    assert.match(first, /^\/create\/image\?error=/);
    assert.equal(aiStub.__calls(), 1);
    assert.equal(prismaStub.__lastCreate(), null, "a failed generation saves nothing");

    // A genuine retry (new payload, same window) must not read as a duplicate.
    aiStub.__setResult({
      ok: true,
      draft: {
        title: "t", hook: "h", body: "b", caption: "c",
        hashtags: ["#x"], cta: "cta", visualDirection: "v",
        storyboard: {}, artboard: {}, design: {},
      },
      model: "openai:gemini-3.8-flash",
      imageMeta: { mimeType: "image/png", bytes: 11 },
    });
    const retry = await runAction(imageForm({ instructions: "Second try with different words" }));
    assert.match(retry, /^\/drafts\//, "the retry succeeds");
  });
});
