/**
 * Tests for the shared tabbed-layout component's pure URL logic.
 *
 * The tab bar is server-rendered from a query parameter so the whole app
 * keeps working without client JavaScript. These tests cover the URL
 * builder that every converted page relies on: the tab id must always be
 * present, empty extra params must be dropped, and existing query state
 * (notices, wizard fields) must survive a tab switch.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { tabHref } from "../src/lib/tabs";

describe("tabHref", () => {
  it("builds a plain tab link with no extra params", () => {
    assert.equal(tabHref("/drafts/abc", "tab", {}, "content"), "/drafts/abc?tab=content");
  });

  it("always appends the tab id, even for the first tab", () => {
    assert.equal(tabHref("/settings", "tab", {}, "ai"), "/settings?tab=ai");
  });

  it("drops undefined and empty-string extra params", () => {
    const href = tabHref("/drafts/abc", "tab", { notice: undefined, reason: "" }, "history");
    assert.equal(href, "/drafts/abc?tab=history");
  });

  it("preserves notice state across a tab switch", () => {
    const href = tabHref("/drafts/abc", "tab", { notice: "saved", reason: undefined }, "improve");
    assert.equal(href, "/drafts/abc?notice=saved&tab=improve");
  });

  it("preserves both notice and failure reason", () => {
    const href = tabHref("/drafts/abc", "tab", { notice: "done", reason: "failed" }, "content");
    const url = new URL(href, "http://x");
    assert.equal(url.searchParams.get("tab"), "content");
    assert.equal(url.searchParams.get("notice"), "done");
    assert.equal(url.searchParams.get("reason"), "failed");
  });

  it("supports a custom tab key", () => {
    assert.equal(tabHref("/create", "step", {}, "2"), "/create?step=2");
  });

  it("URL-encodes values that need it", () => {
    const href = tabHref("/drafts/abc", "tab", { notice: "draft saved & ready" }, "export");
    const url = new URL(href, "http://x");
    assert.equal(url.searchParams.get("notice"), "draft saved & ready");
  });
});
