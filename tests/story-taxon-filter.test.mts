import assert from "node:assert/strict";
import test from "node:test";
import { matchesStoryTaxon } from "../src/lib/destination.ts";

const italy = { slug: "italy", kind: "destination" as const };
const europe = { slug: "europe", kind: "destination" as const };
const descendants = new Set(["italy-id"]);

test("an unclassified Italian story remains visible in Italy and Europe", () => {
  const story = { title: "義大利－威尼斯", body: "旅行紀錄", country: null };
  assert.equal(matchesStoryTaxon(story, italy, new Set(), descendants), true);
  assert.equal(matchesStoryTaxon(story, europe, new Set(), descendants), true);
});

test("Taiwan classification takes precedence over an Italy mention", () => {
  const story = { title: "旅程最後一站－回家", body: "從義大利飛回台灣", country: "台灣" };
  assert.equal(matchesStoryTaxon(story, italy, new Set(["taiwan-id"]), descendants), false);
  assert.equal(matchesStoryTaxon(story, italy, new Set(), descendants), false);
});

test("explicit Italy classification is included even without destination words", () => {
  const story = { title: "旅行日記", body: "風景很好", country: null };
  assert.equal(matchesStoryTaxon(story, italy, new Set(["italy-id"]), descendants), true);
  assert.equal(matchesStoryTaxon(story, { slug: "daily-life", kind: "topic" }, new Set(), descendants), false);
});
