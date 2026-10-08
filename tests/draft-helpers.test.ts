/**
 * Draft helpers — clipboard text assembly and revision instructions
 * (src/lib/draft-helpers.ts). Pure functions, tested directly.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { draftCopyText, withRevision } from "../src/lib/draft-helpers.ts";

describe("draftCopyText", () => {
  it("includes every non-empty field in order", () => {
    const out = draftCopyText({
      title: "T",
      hook: "H",
      body: "B",
      caption: "C",
      hashtags: "#a #b",
      cta: "CTA",
    });
    assert.equal(out, "T\n\nH\n\nB\n\nC\n\n#a #b\n\nCTA");
  });

  it("skips empty and whitespace-only fields", () => {
    const out = draftCopyText({ title: "T", hook: "   ", body: null, caption: "" });
    assert.equal(out, "T");
  });

  it("returns an empty string for an empty draft", () => {
    assert.equal(draftCopyText({}), "");
  });

  it("never ends with a separator", () => {
    const out = draftCopyText({ title: "T", hook: "H" });
    assert.ok(!out.endsWith("\n\n"));
  });
});

describe("withRevision", () => {
  it("appends the instruction to the base idea", () => {
    assert.equal(
      withRevision("Launch a lemon drink", "keep it under 80 words"),
      "Launch a lemon drink\n\nRevision request: keep it under 80 words"
    );
  });

  it("works when there is no base idea", () => {
    assert.equal(withRevision(null, "make it punchy"), "Revision request: make it punchy");
  });

  it("returns the idea unchanged for empty or trivial instructions", () => {
    assert.equal(withRevision("Idea", ""), "Idea");
    assert.equal(withRevision("Idea", "  "), "Idea");
    assert.equal(withRevision("Idea", null), "Idea");
    assert.equal(withRevision("Idea", "ok"), "Idea", "a two-character instruction is not actionable");
  });

  it("trims the instruction", () => {
    assert.equal(
      withRevision("Idea", "   shorter please   "),
      "Idea\n\nRevision request: shorter please"
    );
  });
});