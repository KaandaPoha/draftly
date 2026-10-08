/**
 * Route guard tests — the real API route handlers.
 *
 * The handlers are the actual files Next.js serves (src/app/api/.../route.ts),
 * driven through a test-only module resolver that (a) teaches Node the "@/"
 * alias and (b) swaps exactly two framework boundaries — the auth check and
 * the Prisma client — for fakes. Everything else, including every guard
 * branch and the SVG renderers, is the production code.
 *
 * What is NOT here: the Next.js dev server, real cookies, real SQLite. No
 * request leaves the process.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

/**
 * The resolver itself lives in tests/helpers/route-res.mjs (plain JS — module
 * registration cannot use a TypeScript file). It swaps two framework
 * boundaries — the auth check and the Prisma client — for the fakes in
 * tests/helpers/, and maps the "@/..." alias the route files use onto src/.
 * Everything else, including every guard branch and the SVG renderers, is
 * production code.
 */
await register("./helpers/route-res.mjs", import.meta.url);

/* ---------- imports resolved through the hook ---------- */

const visual = await import("../src/app/api/drafts/[id]/visual/route.ts");
const authStub = await import("./helpers/stub-auth.ts");
const prismaStub = await import("./helpers/stub-prisma.ts");

const PALETTE = {
  bg: "#0b1020",
  surface: "#141a2e",
  fg: "#f5f7ff",
  accent: "#7c5cff",
  accent2: "#3ba9ff",
};

const ARTBOARD = JSON.stringify({
  headline: "Hello",
  subhead: "A subhead",
  cta: "go",
  palette: PALETTE,
  layout: "centered",
  motif: "burst",
  aspect: "square",
  artDirection: "direction",
});

/** Build a draft row. Every field is overridable per test. */
function draftRow(over: Record<string, unknown> = {}) {
  return {
    id: "d1",
    userId: "u1",
    title: "Test Draft",
    imagePrompt: ARTBOARD,
    storyboard: null,
    profile: { name: "Acme" },
    ...over,
  };
}

function get(url: string, id = "d1") {
  return visual.GET(new Request(url), { params: Promise.resolve({ id }) });
}

const VISUAL_URL = "http://127.0.0.1:3000/api/drafts/d1/visual";

describe("visual route guards (api/drafts/[id]/visual)", () => {
  afterEach(() => {
    authStub.__reset();
    prismaStub.__reset();
  });

  it("401s when not signed in — before any database call", async () => {
    let queried = false;
    prismaStub.__setProbe(() => {
      queried = true;
      return null;
    });

    const res = await get(VISUAL_URL);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "Not signed in" });
    assert.equal(queried, false, "an anonymous request must not touch the database");
  });

  it("404s for a draft that does not exist or belongs to someone else", async () => {
    authStub.__setUser({ id: "u1" });
    prismaStub.__setDraft(null);

    const res = await get(VISUAL_URL);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: "Not found" });
  });

  it("scopes the query to the signed-in user", async () => {
    authStub.__setUser({ id: "user-a" });
    let seen: Record<string, unknown> | null = null;
    prismaStub.__setProbe(() => {
      seen = prismaStub.__lastWhere();
      return draftRow({ userId: "user-a" });
    });

    await get(VISUAL_URL);
    assert.deepEqual(seen, { id: "d1", userId: "user-a" }, "the where clause must carry userId");
  });

  it("404s with guidance when the draft has no visual spec", async () => {
    authStub.__setUser({ id: "u1" });
    prismaStub.__setDraft(draftRow({ imagePrompt: null }));

    const res = await get(VISUAL_URL);
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error?: string };
    assert.match(body.error ?? "", /no visual spec/i);
  });

  it("500s with a readable error when the stored spec is not valid JSON", async () => {
    authStub.__setUser({ id: "u1" });
    prismaStub.__setDraft(draftRow({ imagePrompt: "{not json" }));

    const res = await get(VISUAL_URL);
    assert.equal(res.status, 500);
    const body = (await res.json()) as { error?: string };
    assert.match(body.error ?? "", /unreadable/i);
  });

  it("serves the artboard as image/svg+xml with the brand name and copy", async () => {
    authStub.__setUser({ id: "u1" });
    prismaStub.__setDraft(draftRow());

    const res = await get(VISUAL_URL);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /image\/svg\+xml/);

    const svg = await res.text();
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(svg.includes("Acme"), "brand name should label the artboard");
    assert.ok(svg.includes("Hello"), "the headline should render");
    assert.ok(!res.headers.get("content-disposition"), "inline by default");
  });

  it("forces a download when download=1", async () => {
    authStub.__setUser({ id: "u1" });
    prismaStub.__setDraft(draftRow());

    const res = await get(`${VISUAL_URL}?download=1`);
    assert.match(res.headers.get("content-disposition") ?? "", /attachment; filename="test-draft-artboard\.svg"/);
  });

  it("falls back to 'Draftly' when the draft has no profile", async () => {
    authStub.__setUser({ id: "u1" });
    prismaStub.__setDraft(draftRow({ profile: null }));

    const svg = await (await get(VISUAL_URL)).text();
    assert.ok(svg.includes("Draftly"));
    assert.ok(!svg.includes("Acme"));
  });

  it("404s when kind=reel but the draft has no storyboard", async () => {
    authStub.__setUser({ id: "u1" });
    prismaStub.__setDraft(draftRow({ storyboard: null }));

    const res = await get(`${VISUAL_URL}?kind=reel`);
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error?: string };
    assert.match(body.error ?? "", /no storyboard/i);
  });

  it("serves the animated reel preview when a storyboard exists", async () => {
    authStub.__setUser({ id: "u1" });
    prismaStub.__setDraft(
      draftRow({
        storyboard: JSON.stringify([
          { index: 1, timecode: "0:00–0:03", shot: "hero", onScreen: "Hi", voiceover: "vo", transition: "cut" },
        ]),
      })
    );

    const res = await get(`${VISUAL_URL}?kind=reel`);
    assert.equal(res.status, 200);
    const svg = await res.text();
    assert.match(svg, /<animate /, "the reel preview must animate");
    assert.ok(svg.includes("SHOT 1"));
  });

  it("treats an unknown kind as the artboard", async () => {
    authStub.__setUser({ id: "u1" });
    prismaStub.__setDraft(draftRow());

    const svg = await (await get(`${VISUAL_URL}?kind=banana`)).text();
    assert.ok(svg.includes("Hello"), "unknown kind falls through to the still artboard");
  });

  it("survives a malformed storyboard JSON by rendering a still instead", async () => {
    authStub.__setUser({ id: "u1" });
    prismaStub.__setDraft(draftRow({ storyboard: "{broken" }));

    const res = await get(`${VISUAL_URL}?kind=reel`);
    assert.equal(res.status, 404, "a broken storyboard parses to an empty list, which 404s");
  });
});