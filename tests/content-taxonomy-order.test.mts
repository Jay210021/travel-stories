import assert from "node:assert/strict";
import test from "node:test";
import { descendantIds, reorderSiblings } from "../src/lib/content-taxonomy-order.ts";

const nodes = [
  { id: "a", parent_id: null, sort_order: 10 }, { id: "b", parent_id: null, sort_order: 20 },
  { id: "a1", parent_id: "a", sort_order: 10 }, { id: "a2", parent_id: "a", sort_order: 20 },
  { id: "a21", parent_id: "a2", sort_order: 10 },
];
test("collects every descendant", () => assert.deepEqual([...descendantIds(nodes, "a")].sort(), ["a", "a1", "a2", "a21"]));
test("reorders only siblings and normalizes positions", () => assert.deepEqual(reorderSiblings(nodes, "b", "a")?.map(({ id, sort_order }) => [id, sort_order]), [["b", 10], ["a", 20]]));
test("rejects cross-parent reorder", () => assert.equal(reorderSiblings(nodes, "a1", "b"), null));
