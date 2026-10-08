/**
 * Submit-guard — double-click protection for long-running server actions
 * (src/lib/submit-guard.ts).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { submitToken, once } from "../src/lib/submit-guard.ts";

describe("submit guard", () => {
  it("allows the first submission and blocks an immediate duplicate", () => {
    const t = submitToken("create-generate", "user1|idea|Instagram|captions|0");
    assert.equal(once(t), true, "first submit passes");
    assert.equal(once(t), false, "duplicate within the window is blocked");
  });

  it("different payloads produce different tokens", () => {
    const a = submitToken("create-generate", "u1|idea A|Instagram|captions|0");
    const b = submitToken("create-generate", "u1|idea B|Instagram|captions|0");
    assert.notEqual(a, b);
  });

  it("different users never collide on the same brief", () => {
    const a = submitToken("create-generate", "u1|idea|Instagram|captions|0");
    const b = submitToken("create-generate", "u2|idea|Instagram|captions|0");
    assert.notEqual(a, b);
    assert.equal(once(b), true, "the second user is not blocked by the first");
  });

  it("different actions never collide", () => {
    const a = submitToken("create-generate", "same");
    const b = submitToken("regenerate", "same");
    assert.notEqual(a, b);
  });
});