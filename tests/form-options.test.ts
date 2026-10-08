/**
 * Form options — the dropdown lists shared by the create wizard, the compare
 * form, and the profile editor.
 *
 * These tests pin the contract the generation pipeline depends on: every
 * dropdown value must either be something the pipeline understands or be
 * handled generically. If someone adds an option here that the pipeline
 * cannot use, these tests are the tripwire.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PLATFORMS,
  GOALS,
  FORMATS,
  AGE_RANGES,
  INTERESTS,
  TONES,
  LANGUAGES,
} from "../src/lib/form-options.ts";
import { generateDraft, type GenerationInput } from "../src/lib/generate.ts";
import { buildUserPrompt } from "../src/lib/prompt.ts";

const BASE: GenerationInput = {
  idea: "A sparkling lemon drink for young adults in Bengaluru into fitness",
  profile: null,
  audience: "young adults in Bengaluru interested in fitness",
  platform: "Instagram",
  goal: "Awareness",
  format: "captions",
  variant: 0,
};

describe("form options (lib/form-options.ts)", () => {
  it("lists every platform the user was promised, including the newer ones", () => {
    for (const p of ["Instagram", "TikTok", "YouTube", "LinkedIn", "Facebook", "X", "Pinterest"]) {
      assert.ok(PLATFORMS.includes(p as never), `${p} should be an option`);
    }
  });

  it("ends escape-hatch lists with Other", () => {
    for (const [name, list] of [
      ["platforms", PLATFORMS],
      ["goals", GOALS],
      ["age ranges", AGE_RANGES],
    ] as const) {
      assert.equal(list.at(-1), "Other", `${name} should end with Other`);
    }
  });

  it("keeps the interests list open-ended — no Other needed next to the free-text field", () => {
    assert.ok(INTERESTS.length >= 10);
  });

  it("keeps tones and languages non-empty", () => {
    assert.ok(TONES.length >= 5);
    assert.ok(LANGUAGES.length >= 5);
  });

  it("gives every format a human label", () => {
    for (const f of FORMATS) {
      assert.ok(f.label.length > 2, `${f.value} needs a label`);
      assert.equal(typeof f.value, "string");
    }
  });

  describe("pipeline compatibility — every dropdown value generates a draft", () => {
    it("handles every platform option without throwing", () => {
      for (const p of PLATFORMS) {
        const draft = generateDraft({ ...BASE, platform: p });
        assert.ok(draft.hook || draft.caption, `${p} should produce copy`);
      }
    });

    it("handles every format option without throwing", () => {
      for (const f of FORMATS) {
        const draft = generateDraft({ ...BASE, format: f.value });
        assert.ok(draft.title, `${f.value} should produce a title`);
      }
    });

    it("handles every goal option without throwing", () => {
      for (const g of GOALS) {
        const draft = generateDraft({ ...BASE, goal: g });
        assert.ok(draft.cta, `${g} should produce a CTA`);
      }
    });
  });

  describe("selected values reach the generation prompt", () => {
    it("puts the chosen platform, goal, and format into the user prompt", () => {
      const prompt = buildUserPrompt({
        ...BASE,
        platform: "TikTok",
        goal: "Reach",
        format: "reel",
      });
      assert.match(prompt, /TikTok/);
      assert.match(prompt, /Reach/);
      assert.match(prompt, /reel/i);
    });

    it("carries the interests dropdown and the free-text Other field into the audience", () => {
      // The action joins [age, location, interest, other] — verify the last
      // part is additive by checking the prompt builder consumes it.
      const joined = ["18–24", "Bengaluru", "Fitness & gym", "hostel life"]
        .filter(Boolean)
        .join(", ");
      assert.match(buildUserPrompt({ ...BASE, audience: joined }), /hostel life/);
    });
  });
});
