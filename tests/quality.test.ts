/**
 * Quality evaluation tests — src/lib/quality.ts :: evaluateDraft
 *
 * These are heuristic editorial checks, NOT predictions of performance. The
 * tests pin that semantics: the six dimensions must appear, and clearly
 * different inputs must score differently where the current rules support a
 * distinction. Nothing here asserts that a score predicts reach or engagement.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateDraft } from "../src/lib/quality.ts";

const CONTEXT = {
  platform: "Instagram",
  goal: "Increase engagement",
  format: "captions",
  hasProfile: true,
  audience: "College students 18-24, India, hostel life",
};

/** A draft that should score well across the board. */
const STRONG = {
  hook: "It's 11pm and the problem set is due at 8am.",
  body: "Built for college students in India who study late.\n\nMidnight Mocha does the job you actually have.",
  caption:
    "Midnight Mocha is made for college students who study late. Save this for your next all-nighter.",
  cta: "Save this for your next all-nighter.",
  hashtags: ["#midnightmocha", "#collegelife"],
};

describe("quality evaluation (lib/quality.ts)", () => {
  it("returns exactly the six specified dimensions", () => {
    const r = evaluateDraft(STRONG, CONTEXT);
    assert.deepEqual(
      r.dimensions.map((d) => d.label),
      [
        "Hook clarity",
        "Readability",
        "Audience relevance",
        "Platform suitability",
        "CTA clarity",
        "Brand voice consistency",
      ]
    );
  });

  it("every dimension carries an explanation and a valid score", () => {
    const r = evaluateDraft(STRONG, CONTEXT);
    for (const d of r.dimensions) {
      assert.ok(d.why.length > 10, `${d.label} should explain itself`);
      assert.ok(d.score >= 0 && d.score <= 3, `${d.label} score out of range`);
    }
  });

  it("reports the platform's character budget", () => {
    const r = evaluateDraft(STRONG, CONTEXT);
    assert.match(r.lengthUse, /2200/);
    assert.match(r.lengthUse, /Instagram/);
  });

  it("a fix never appears on a top-scoring dimension", () => {
    const r = evaluateDraft(STRONG, CONTEXT);
    for (const d of r.dimensions) {
      if (d.score === 3) {
        assert.equal(d.fix, undefined, `${d.label} scored 3 but still suggests a fix`);
        assert.equal(d.action, undefined);
      }
    }
  });

  describe("hook clarity discriminates", () => {
    it("a long hook scores lower than a short one", () => {
      const longHook = evaluateDraft(
        {
          ...STRONG,
          hook: "We are absolutely thrilled to finally announce the launch of our brand new product today",
        },
        CONTEXT
      );
      const short = evaluateDraft(STRONG, CONTEXT);
      const longScore = longHook.dimensions.find((d) => d.key === "hook")!.score;
      const shortScore = short.dimensions.find((d) => d.key === "hook")!.score;
      assert.ok(
        longScore < shortScore,
        `long hook (${longScore}) should score below short hook (${shortScore})`
      );
    });

    it("a missing hook scores lowest and suggests a fix", () => {
      const r = evaluateDraft({ ...STRONG, hook: "" }, CONTEXT);
      const hook = r.dimensions.find((d) => d.key === "hook")!;
      assert.equal(hook.score, 0);
      assert.ok(hook.fix);
      assert.equal(hook.action, "new_hook");
    });
  });

  describe("readability discriminates", () => {
    it("dense prose scores lower than short sentences", () => {
      // The scale is deliberately coarse, so the inputs must be decisively
      // different rather than marginally so.
      const dense = evaluateDraft(
        {
          ...STRONG,
          caption:
            "We carefully developed this beverage so that it delivers steady energy across the whole evening for every student who is working late and needs something they can rely on.",
          body: "Our premium chocolate beverage has been specifically formulated and carefully developed to provide sustained energy throughout the entire evening for students who are studying late.",
        },
        CONTEXT
      );
      const denseScore = dense.dimensions.find((d) => d.key === "readability")!.score;
      const cleanScore = evaluateDraft(STRONG, CONTEXT).dimensions.find(
        (d) => d.key === "readability"
      )!.score;
      assert.ok(denseScore < cleanScore, `dense (${denseScore}) should be below clean (${cleanScore})`);
      assert.ok(denseScore <= 2, `dense prose should not score top marks (got ${denseScore})`);
      assert.ok(
        dense.dimensions.find((d) => d.key === "readability")!.action === "shorter",
        "dense prose should point at the shorter transform"
      );
    });

    it("the dimension is an editorial check, not a performance claim", () => {
      const r = evaluateDraft(STRONG, CONTEXT);
      const why = r.dimensions.find((d) => d.key === "readability")!.why;
      assert.doesNotMatch(why, /engagement|reach|conversion|will perform|predict/i);
    });
  });

  describe("audience relevance discriminates", () => {
    it("copy reflecting the user's own audience words scores higher than copy that ignores them", () => {
      const onAudience = evaluateDraft(STRONG, CONTEXT); // mentions "college students"
      const offAudience = evaluateDraft(
        {
          ...STRONG,
          hook: "Something entirely different happened today.",
          body: "A general announcement about our range and what makes it worth considering this season.",
          caption: "Our range is here. Take a look at the full collection today.",
        },
        CONTEXT
      );
      const on = onAudience.dimensions.find((d) => d.key === "audience")!.score;
      const off = offAudience.dimensions.find((d) => d.key === "audience")!.score;
      assert.ok(on > off, `on-audience (${on}) should beat off-audience (${off})`);
    });

    it("no audience supplied is scored as a gap, not silently passed", () => {
      const r = evaluateDraft(STRONG, { ...CONTEXT, audience: null });
      const a = r.dimensions.find((d) => d.key === "audience")!;
      assert.ok(a.score < 3);
      assert.ok(a.fix);
    });
  });

  describe("platform suitability discriminates", () => {
    it("an over-limit caption scores 0 on X", () => {
      const long = { ...STRONG, caption: "x".repeat(400) };
      const over = evaluateDraft(long, { ...CONTEXT, platform: "X", audience: null });
      assert.equal(over.dimensions.find((d) => d.key === "platform")!.score, 0);
    });

    it("a fitting caption scores well", () => {
      const r = evaluateDraft(STRONG, CONTEXT);
      assert.equal(r.dimensions.find((d) => d.key === "platform")!.score, 3);
    });
  });

  describe("CTA clarity discriminates", () => {
    it("one clear ask beats a scatter of asks", () => {
      const single = evaluateDraft(STRONG, CONTEXT);
      const scatter = evaluateDraft(
        { ...STRONG, cta: "Comment below, save this post, share it, click the link, and follow for more." },
        CONTEXT
      );
      const a = single.dimensions.find((d) => d.key === "cta")!.score;
      const b = scatter.dimensions.find((d) => d.key === "cta")!.score;
      assert.ok(a > b, `single ask (${a}) should beat scattered asks (${b})`);
    });

    it("a missing CTA scores 0 with a fix suggested", () => {
      const r = evaluateDraft({ ...STRONG, cta: "" }, CONTEXT);
      const cta = r.dimensions.find((d) => d.key === "cta")!;
      assert.equal(cta.score, 0);
      assert.equal(cta.action, "better_cta");
    });
  });

  describe("brand voice consistency", () => {
    it("a saved profile scores higher than none", () => {
      const withP = evaluateDraft(STRONG, CONTEXT).dimensions.find((d) => d.key === "voice")!.score;
      const noP = evaluateDraft(STRONG, { ...CONTEXT, hasProfile: false }).dimensions.find(
        (d) => d.key === "voice"
      )!.score;
      assert.ok(withP > noP, `profile (${withP}) should beat no profile (${noP})`);
      assert.ok(noP < 3);
    });

    it("no-profile explains the gap rather than pretending a voice was learned", () => {
      const r = evaluateDraft(STRONG, { ...CONTEXT, hasProfile: false });
      const v = r.dimensions.find((d) => d.key === "voice")!;
      assert.match(v.why, /neutral voice rather than yours/);
    });
  });

  it("format and goal flow through without changing the dimension set", () => {
    const r = evaluateDraft(STRONG, {
      ...CONTEXT,
      format: "reel",
      goal: "Product launch",
    });
    assert.equal(r.dimensions.length, 6);
  });
});