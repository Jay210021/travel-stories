import assert from "node:assert/strict";
import test from "node:test";
import { assignedClassificationLabels, type ClassificationTaxon } from "../src/lib/story-classification.ts";
import { matchesStorySearch } from "../src/lib/story-search.ts";

const taxa = new Map<string, ClassificationTaxon>([
  ["europe", { id: "europe", label: "歐洲", parent_id: null }],
  ["italy", { id: "italy", label: "義大利", parent_id: "europe" }],
  ["taiwan", { id: "taiwan", label: "台灣", parent_id: null }],
]);

test("search includes the assigned classification and its parent", () => {
  const labels = assignedClassificationLabels(["italy"], taxa);
  assert.deepEqual(labels.display, ["義大利"]);
  assert.deepEqual(labels.search, ["義大利", "歐洲"]);
  const story = { title: "威尼斯的早晨", classification_search_labels: labels.search };
  assert.equal(matchesStorySearch(story, "義大利"), true);
  assert.equal(matchesStorySearch(story, "歐洲"), true);
  assert.equal(matchesStorySearch(story, "威尼斯"), true);
});

test("search does not match article body or unrelated classifications", () => {
  const story = {
    title: "回家",
    body: "這篇內文提到義大利。",
    classification_search_labels: assignedClassificationLabels(["taiwan"], taxa).search,
  };
  assert.equal(matchesStorySearch(story, "義大利"), false);
  assert.equal(matchesStorySearch(story, "台灣"), true);
});
