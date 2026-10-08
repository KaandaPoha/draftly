/**
 * Image upload validation tests — src/lib/image-input.ts
 *
 * The real production validator is exercised directly: every branch (empty
 * file, size cap, declared type, magic-byte sniffing, type/content mismatch)
 * is checked, including adversarial cases where a browser-declared MIME type
 * lies about the file's contents.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  validateImage,
  sniffImageType,
  toDataUrl,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "../src/lib/image-input.ts";

const encoder = (s: string) => new TextEncoder().encode(s);

/** A minimal valid PNG header (first 8 magic bytes + some payload). */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
/** A minimal JPEG start (FF D8 FF + payload). */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
/** A minimal WebP start (RIFF + size + WEBP). */
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2, 3,
]);

describe("sniffImageType", () => {
  it("recognises PNG, JPEG and WebP magic bytes", () => {
    assert.equal(sniffImageType(PNG), "image/png");
    assert.equal(sniffImageType(JPEG), "image/jpeg");
    assert.equal(sniffImageType(WEBP), "image/webp");
  });

  it("returns null for non-images", () => {
    assert.equal(sniffImageType(encoder("<html>not an image</html>")), null);
    assert.equal(sniffImageType(encoder("PK\x03\x04")), null); // a zip
    assert.equal(sniffImageType(new Uint8Array(0)), null);
  });

  it("does not match when the header is truncated", () => {
    assert.equal(sniffImageType(PNG.slice(0, 4)), null);
    assert.equal(sniffImageType(JPEG.slice(0, 2)), null);
  });
});

describe("validateImage", () => {
  it("accepts a real PNG declared as PNG", () => {
    const out = validateImage({ declaredType: "image/png", bytes: PNG });
    assert.equal(out.ok, true);
    assert.deepEqual((out as { ok: true }).ok, true);
  });

  it("rejects an empty file", () => {
    const out = validateImage({ declaredType: "image/png", bytes: new Uint8Array(0) });
    assert.ok(!out.ok);
    assert.match(out.ok ? "" : out.error, /empty/i);
  });

  it("rejects files over the size limit", () => {
    const huge = new Uint8Array(MAX_IMAGE_BYTES + 1);
    const out = validateImage({ declaredType: "image/png", bytes: huge });
    assert.ok(!out.ok);
    assert.match(out.ok ? "" : out.error, /limit/i);
  });

  it("rejects unsupported declared types (e.g. a PDF or an EXE)", () => {
    const out = validateImage({ declaredType: "application/pdf", bytes: PNG });
    assert.ok(!out.ok);
    assert.match(out.ok ? "" : out.error, /Unsupported file type/i);
  });

  it("rejects files whose bytes are not a real image", () => {
    const out = validateImage({ declaredType: "image/png", bytes: encoder("<script>alert(1)</script>") });
    assert.ok(!out.ok);
    assert.match(out.ok ? "" : out.error, /real image/i);
  });

  it("rejects a mismatch between declared and actual type", () => {
    // Bytes say JPEG, declaration says PNG — reject rather than trust.
    const out = validateImage({ declaredType: "image/png", bytes: JPEG });
    assert.ok(!out.ok);
    assert.match(out.ok ? "" : out.error, /do not match/i);
  });

  it("accepts every allowed type when declared and sniffed agree", () => {
    for (const [type, bytes] of [
      ["image/jpeg", JPEG],
      ["image/png", PNG],
      ["image/webp", WEBP],
    ] as const) {
      assert.equal(validateImage({ declaredType: type, bytes }).ok, true);
    }
  });

  it("does not treat case or whitespace in the declared type as new types", () => {
    assert.equal(validateImage({ declaredType: "IMAGE/PNG", bytes: PNG }).ok, true);
    assert.equal(validateImage({ declaredType: " image/png ", bytes: PNG }).ok, true);
  });
});

describe("toDataUrl", () => {
  it("produces a base64 data URL with the right prefix", () => {
    const url = toDataUrl(PNG, "image/png");
    assert.ok(url.startsWith("data:image/png;base64,"));
    const payload = url.slice("data:image/png;base64,".length);
    // Round-trip the base64 back and compare with the original bytes.
    const round = Buffer.from(payload, "base64");
    assert.deepEqual(new Uint8Array(round), PNG);
  });

  it("survives a multi-chunk (multi-MB) input", () => {
    const big = new Uint8Array(2 * 1024 * 1024).map((_, i) => i % 256);
    const url = toDataUrl(big, "image/jpeg");
    const round = new Uint8Array(Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
    assert.equal(round.length, big.length);
    assert.deepEqual(round, big);
  });
});

describe("allowed types", () => {
  it("are exactly the three supported formats", () => {
    assert.deepEqual(ALLOWED_IMAGE_TYPES, ["image/jpeg", "image/png", "image/webp"]);
  });
});
