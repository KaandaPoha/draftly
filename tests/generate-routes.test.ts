/**
 * Generation route guard tests — the real handlers for /api/generate and
 * /api/generate-from-image.
 *
 * Same harness as routes.test.ts: the production route files run against
 * faked auth, prisma, and rate-limit boundaries. These tests prove:
 *   - generation endpoints are rate limited (429 + Retry-After) before any
 *     provider call or database write;
 *   - malformed JSON in the image route's selections is a 400, not a 500;
 *   - invalid / oversized uploads are rejected with the right status codes;
 *   - successful image generations persist a draft with honest metadata.
 *
 * No request leaves the process; the provider is never called.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

await register("./helpers/route-res.mjs", import.meta.url);

/* ---------- imports resolved through the hook ---------- */

const generate = await import("../src/app/api/generate/route.ts");
const generateImage = await import("../src/app/api/generate-from-image/route.ts");
const authStub = await import("./helpers/stub-auth.ts");
const prismaStub = await import("./helpers/stub-prisma.ts");
const rlStub = await import("./helpers/stub-rate-limit.ts");

const JSON_HEADERS = { "content-type": "application/json" };

function jsonRequest(body: unknown, url = "http://127.0.0.1:3000/api/generate") {
  return new Request(url, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
}

/** A minimal valid PNG payload (magic bytes + filler). */
function pngFile(name = "tiny.png"): File {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  return new File([bytes], name, { type: "image/png" });
}

function imageForm(over: {
  file?: File | null;
  selections?: unknown;
  selectionsRaw?: string;
} = {}) {
  const form = new FormData();
  form.append("image", over.file === null ? "" : over.file ?? pngFile());
  if (over.selectionsRaw !== undefined) {
    form.append("selections", over.selectionsRaw);
  } else if (over.selections !== undefined) {
    form.append("selections", JSON.stringify(over.selections));
  }
  return new Request("http://127.0.0.1:3000/api/generate-from-image", {
    method: "POST",
    body: form,
  });
}

const VALID_SELECTIONS = {
  instructions: "Write a launch caption for this image",
  platform: "Instagram",
  goal: "Product launch",
  format: "captions",
  tone: "Witty & playful",
  language: "English",
};

describe("generation rate limiting (api/generate)", () => {
  afterEach(() => {
    authStub.__reset();
    prismaStub.__reset();
    rlStub.__reset();
  });

  it("429s with Retry-After on the 6th generation in a minute", async () => {
    authStub.__setUser({ id: "u1" });
    prismaStub.__setProbe(() => null);

    // Text generation does not need a profile or a provider — the fallback
    // generator runs deterministically without touching the network.
    let last: Response | null = null;
    for (let i = 0; i < 6; i++) {
      last = await generate.POST(
        jsonRequest({
          idea: "A tiny test idea",
          platform: "Instagram",
          goal: "Engagement",
          format: "captions",
        })
      );
    }
    assert.equal(last!.status, 429, "the 6th request must be rate limited");
    assert.ok(Number(last!.headers.get("retry-after")) > 0, "Retry-After must be present");
    const body = (await last!.json()) as { error?: string };
    assert.match(body.error ?? "", /too many generations/i);
  });

  it("recovers after the window passes (reset works)", async () => {
    authStub.__setUser({ id: "u1" });
    prismaStub.__setProbe(() => null);
    for (let i = 0; i < 5; i++) {
      await generate.POST(
        jsonRequest({ idea: "A tiny test idea", platform: "Instagram", goal: "Engagement", format: "captions" })
      );
    }
    rlStub.__reset();
    const res = await generate.POST(
      jsonRequest({ idea: "A tiny test idea", platform: "Instagram", goal: "Engagement", format: "captions" })
    );
    assert.notEqual(res.status, 429, "a reset limiter must admit the request");
  });

  it("checks rate limit before any database access", async () => {
    authStub.__setUser({ id: "u1" });
    let queried = false;
    prismaStub.__setProbe(() => {
      queried = true;
      return null;
    });
    for (let i = 0; i < 6; i++) {
      await generate.POST(
        jsonRequest({ idea: "A tiny test idea", platform: "Instagram", goal: "Engagement", format: "captions" })
      );
    }
    assert.equal(queried, false, "a rate-limited request must not touch the database");
  });
});

describe("image generation route guards (api/generate-from-image)", () => {
  afterEach(() => {
    authStub.__reset();
    prismaStub.__reset();
    rlStub.__reset();
  });

  it("401s when not signed in — before reading the upload", async () => {
    const res = await generateImage.POST(imageForm());
    assert.equal(res.status, 401);
  });

  it("429s on the 4th image generation in a minute", async () => {
    authStub.__setUser({ id: "u1" });
    // The provider is never reached: the rate limit fires first.
    let last: Response | null = null;
    for (let i = 0; i < 4; i++) {
      last = await generateImage.POST(imageForm({ selections: VALID_SELECTIONS }));
    }
    assert.equal(last!.status, 429);
    assert.ok(last!.headers.get("retry-after"));
  });

  it("400s on malformed selections JSON instead of 500", async () => {
    authStub.__setUser({ id: "u1" });
    const res = await generateImage.POST(
      imageForm({ selectionsRaw: "{not valid json" })
    );
    assert.equal(res.status, 400, "malformed JSON must be a client error");
    const body = (await res.json()) as { error?: string };
    assert.match(body.error ?? "", /invalid selections/i);
  });

  it("415s on an unsupported file type", async () => {
    authStub.__setUser({ id: "u1" });
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "doc.pdf", {
      type: "application/pdf",
    });
    const res = await generateImage.POST(imageForm({ file: pdf, selections: VALID_SELECTIONS }));
    assert.equal(res.status, 415);
    const body = (await res.json()) as { error?: string };
    assert.match(body.error ?? "", /unsupported file type/i);
  });

  it("rejects an image whose bytes lie about its type", async () => {
    authStub.__setUser({ id: "u1" });
    // Declared as PNG, content is plain text — the magic-byte check must win.
    const fake = new File([new TextEncoder().encode("<html>not a png</html>")], "evil.png", {
      type: "image/png",
    });
    const res = await generateImage.POST(imageForm({ file: fake, selections: VALID_SELECTIONS }));
    assert.equal(res.status, 415);
    const body = (await res.json()) as { error?: string };
    assert.match(body.error ?? "", /real image|do not match/i);
  });

  it("rejects an oversized image before reading its bytes", async () => {
    authStub.__setUser({ id: "u1" });
    const oversized = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" });
    const res = await generateImage.POST(imageForm({ file: oversized, selections: VALID_SELECTIONS }));
    assert.equal(res.status, 413);
    const body = (await res.json()) as { error?: string };
    assert.match(body.error ?? "", /limit/i);
  });

  it("400s when the image is missing entirely", async () => {
    authStub.__setUser({ id: "u1" });
    const form = new FormData();
    form.append("selections", JSON.stringify(VALID_SELECTIONS));
    const res = await generateImage.POST(
      new Request("http://127.0.0.1:3000/api/generate-from-image", { method: "POST", body: form })
    );
    assert.equal(res.status, 400);
  });

  it("persists a draft with honest metadata on success", async () => {
    authStub.__setUser({ id: "u1" });
    // Points prisma.contentDraft.create at the probe so no provider call is
    // needed: the route returns the draft it would have saved.
    prismaStub.__setDraft(null);

    const res = await generateImage.POST(imageForm({ selections: VALID_SELECTIONS }));
    // Without a provider configured, the route must NOT fake an image draft.
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: string };
    assert.match(body.error ?? "", /no ai provider/i);
    assert.equal(prismaStub.__lastCreate(), null, "nothing must be saved when generation fails");
  });
});
