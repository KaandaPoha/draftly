/**
 * Visual generation tests — src/lib/visual.ts
 *
 * Everything here is local and deterministic: no network, no key, no provider.
 * The SVG renderers are the "real image" half of generation, so these tests
 * pin their contract: valid specs render, hostile/blank inputs stay safe, and
 * the output is stable enough to cache.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ARTBOARD_DIMENSIONS,
  renderArtboard,
  renderReelPreview,
  estimateProduction,
} from "../src/lib/visual.ts";
import type { ArtboardSpec, StoryboardShot } from "../src/lib/generate.ts";

const PALETTE: ArtboardSpec["palette"] = {
  bg: "#0b1020",
  surface: "#141a2e",
  fg: "#f5f7ff",
  accent: "#7c5cff",
  accent2: "#3ba9ff",
};

const SPEC: ArtboardSpec = {
  headline: "Meet the new chocolate energy drink",
  subhead: "Built for late-night study sessions",
  cta: "Try it today",
  palette: PALETTE,
  layout: "centered",
  motif: "burst",
  aspect: "square",
  artDirection: "bold type over a single hero subject",
};

const spec = (over: Partial<ArtboardSpec> = {}): ArtboardSpec => ({ ...SPEC, ...over });

const shot = (over: Partial<StoryboardShot> = {}): StoryboardShot => ({
  index: 1,
  timecode: "0:00–0:03",
  shot: "Macro shot of the bottle being opened",
  onScreen: "Late night?",
  voiceover: "Say hello to steady energy",
  transition: "cut",
  ...over,
});

describe("renderArtboard (lib/visual.ts)", () => {
  it("returns a standalone SVG document", () => {
    const svg = renderArtboard(SPEC, "Acme");
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(svg.trimEnd().endsWith("</svg>"), "SVG must be closed");
    assert.match(svg, /viewBox="0 0 /);
    assert.match(svg, /role="img"/);
  });

  it("sizes the canvas for each aspect ratio", () => {
    for (const aspect of ["square", "portrait", "landscape"] as const) {
      const { w, h } = ARTBOARD_DIMENSIONS[aspect];
      const svg = renderArtboard(spec({ aspect }), "Acme");
      assert.match(svg, new RegExp(`<svg[^>]*width="${w}"`), `${aspect} width`);
      assert.match(svg, new RegExp(`<svg[^>]*height="${h}"`), `${aspect} height`);
      assert.match(svg, new RegExp(`viewBox="0 0 ${w} ${h}"`), `${aspect} viewBox`);
    }
  });

  it("is deterministic — the same spec always renders the same image", () => {
    assert.equal(renderArtboard(SPEC, "Acme"), renderArtboard(SPEC, "Acme"));
  });

  it("wraps a long headline across multiple text lines", () => {
    const svg = renderArtboard(SPEC, "Acme");
    const headlineLines = svg.match(/font-weight="700"/g) ?? [];
    assert.ok(
      headlineLines.length > 1,
      `a long headline should wrap, got ${headlineLines.length} line(s)`
    );
  });

  it("escapes XML so user copy can never break out of the document", () => {
    const svg = renderArtboard(
      spec({
        headline: 'A <b>bold</b> & "quoted" headline',
        subhead: "<script>alert(1)</script>",
        cta: "read <more>",
      }),
      "Ben & Jerry's <Team>"
    );
    assert.ok(!svg.includes("<script>"), "raw script tag must not survive");
    assert.ok(!svg.includes("<b>"), "raw markup from the headline must not survive");
    assert.ok(svg.includes("&lt;script&gt;"), "escaped subhead should be present");
    assert.ok(svg.includes("&amp;"), "ampersands must be escaped");
    assert.ok(svg.includes("&quot;"), "double quotes must be escaped");
    assert.ok(!svg.includes("Ben & Jerry's <Team>"), "brand name must be escaped too");
  });

  it("renders every motif variant without throwing", () => {
    const rendered = (["circles", "grid", "waves", "burst"] as const).map((motif) =>
      renderArtboard(spec({ motif }), "Acme")
    );
    for (const svg of rendered) assert.match(svg, /<\/svg>$/);
    assert.equal(new Set(rendered).size, rendered.length, "motifs should differ visually");
  });

  it("adds the side panel only for split layouts", () => {
    const split = renderArtboard(spec({ layout: "split" }), "Acme");
    const centered = renderArtboard(spec({ layout: "centered" }), "Acme");
    assert.ok(
      split.length > centered.length,
      "the split layout should emit extra panel markup"
    );
  });

  it("uses the supplied palette in the output", () => {
    const svg = renderArtboard(SPEC, "Acme");
    for (const colour of Object.values(PALETTE)) {
      assert.ok(svg.includes(colour), `palette colour ${colour} should appear`);
    }
  });

  it("shows the brand name and the call to action", () => {
    const svg = renderArtboard(SPEC, "Acme Chocolates");
    assert.ok(svg.includes("Acme Chocolates"));
    assert.ok(svg.includes("TRY IT TODAY"), "the CTA is upper-cased into the artboard");
  });

  /**
   * Documents a real edge case rather than an aspiration: renderArtboard
   * destructures ARTBOARD_DIMENSIONS[spec.aspect], so an aspect outside the
   * known union throws. In practice coerceDraft narrows aspect to the union
   * before this is ever called, so this pins the boundary, it does not ask for
   * a change.
   */
  it("throws on an aspect outside the known set (guarded upstream by coerceDraft)", () => {
    const bogus = spec({ aspect: "billboard" as ArtboardSpec["aspect"] });
    assert.throws(() => renderArtboard(bogus, "Acme"), TypeError);
  });
});

describe("renderReelPreview (lib/visual.ts)", () => {
  const shots = [
    shot({ index: 1 }),
    shot({ index: 2, shot: "Close-up of the can", onScreen: "Steady energy", timecode: "0:03–0:06" }),
    shot({ index: 3, shot: "Student drinking it", onScreen: "All evening", timecode: "0:06–0:09" }),
  ];

  it("returns a standalone animated SVG", () => {
    const svg = renderReelPreview(shots, SPEC, "Acme");
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /viewBox="0 0 1080 1350"/, "reels render at portrait size");
    assert.match(svg, /<animate /, "the preview must actually animate");
    assert.match(svg, /animated storyboard preview/);
  });

  it("emits one animated frame per shot", () => {
    const svg = renderReelPreview(shots, SPEC, "Acme");
    const frames = svg.match(/attributeName="opacity"/g) ?? [];
    assert.equal(frames.length, shots.length);
    for (const s of shots) {
      assert.ok(svg.includes(`SHOT ${s.index}`), `shot ${s.index} label`);
    }
  });

  it("caps the preview at eight frames for longer storyboards", () => {
    const many = Array.from({ length: 20 }, (_, i) => shot({ index: i + 1 }));
    const svg = renderReelPreview(many, SPEC, "Acme");
    const frames = svg.match(/attributeName="opacity"/g) ?? [];
    assert.equal(frames.length, 8);
    assert.match(svg, /Animated 8-shot preview/);
  });

  it("still returns a valid SVG for an empty storyboard", () => {
    const svg = renderReelPreview([], SPEC, "Acme");
    assert.match(svg, /<\/svg>$/);
    assert.equal(svg.match(/attributeName="opacity"/g)?.length ?? 0, 0, "no frames to show");
    assert.match(svg, /<animate attributeName="width"/, "the progress bar still animates");
  });

  it("falls back to the shot description when the overlay is absent", () => {
    const svg = renderReelPreview(
      [shot({ onScreen: null as unknown as string, shot: "Macro bottle hero" })],
      SPEC,
      "Acme"
    );
    assert.ok(svg.includes("Macro bottle hero"), "should overlay the shot description");
  });

  /**
   * BUG (cosmetic, documented — not fixed): the fallback is `s.onScreen ||
   * s.shot`, which treats a whitespace-only string as present. wrap() then
   * produces zero lines, so the frame shows no overlay text at all. The
   * generation path never produces this — coerceDraft trims onScreen before
   * the storyboard is persisted — so this pins the edge rather than asking
   * for a production change.
   */
  it("prints no overlay for a whitespace-only onScreen (quirk, unreachable via coerceDraft)", () => {
    const svg = renderReelPreview(
      [shot({ onScreen: "   ", shot: "Macro bottle hero" })],
      SPEC,
      "Acme"
    );
    assert.ok(!svg.includes("Macro bottle hero"), "the fallback is not reached for whitespace");
    assert.match(svg, /<\/svg>$/, "the SVG is still complete");
  });

  it("omits the voiceover line when the field is the em-dash placeholder", () => {
    const withVo = renderReelPreview([shot({ voiceover: "Say hello to steady energy" })], SPEC, "Acme");
    const withoutVo = renderReelPreview([shot({ voiceover: "—" })], SPEC, "Acme");
    assert.ok(withVo.includes("Say hello to steady"), "real voiceover should render");
    assert.ok(!withoutVo.includes("—"), "the placeholder must not be printed");
    assert.ok(withoutVo.length < withVo.length);
  });

  it("escapes XML in shot overlays", () => {
    const svg = renderReelPreview([shot({ onScreen: "<img src=x onerror=1>" })], SPEC, "Acme");
    assert.ok(!svg.includes("<img"), "raw markup must not survive");
    assert.ok(svg.includes("&lt;img"), "escaped overlay should be present");
  });
});

describe("estimateProduction (lib/visual.ts)", () => {
  it("adds on-camera crew and audio kit when shots involve people", () => {
    const withPeople = estimateProduction([{ shot: "Presenter talking to camera" }], false);
    const noPeople = estimateProduction([{ shot: "Product on a desk" }], false);
    assert.match(withPeople.crew, /1 talent/i);
    assert.match(noPeople.crew, /no on-camera talent needed/i);
    assert.ok(withPeople.kit.some((k) => /mic/i.test(k)));
  });

  it("includes a macro lens only when a shot calls for it", () => {
    const macro = estimateProduction([{ shot: "Macro detail of the surface" }], false);
    const wide = estimateProduction([{ shot: "Wide shot of the room" }], false);
    assert.ok(macro.kit.some((k) => /macro/i.test(k)));
    assert.ok(!wide.kit.some((k) => /macro/i.test(k)));
  });

  it("scales the time estimate with the number of shots", () => {
    const short = estimateProduction([{ shot: "a" }], false);
    const long = estimateProduction(Array.from({ length: 8 }, () => ({ shot: "a" })), false);
    const hours = (s: string) => Number(s.match(/^(\d+)/)?.[1]);
    assert.ok(hours(long.hours) > hours(short.hours), `${long.hours} > ${short.hours}`);
  });

  it("mentions motion graphics for animated work", () => {
    const animated = estimateProduction([{ shot: "Product on a desk" }], true);
    assert.match(animated.postNotes, /beat|caption|loop/i);
    assert.ok(animated.kit.some((k) => /After Effects|CapCut/i.test(k)));
  });
});