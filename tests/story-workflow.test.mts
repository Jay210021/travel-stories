import assert from "node:assert/strict";
import test from "node:test";
import { runStoryWorkflow, type StoryWorkflowAction } from "../src/lib/story-workflow.ts";

const story = (id: string, status = "trash") => ({
  id, status, published_at: null, deleted_at: status === "trash" ? "2026-10-07T00:00:00Z" : null, slug: null,
});

test("trash confirms every selected story changed before reporting success", async (t) => {
  const updated = [story("story-2"), story("story-1")];
  t.mock.method(globalThis, "fetch", async (url: string, request: RequestInit) => {
    assert.equal(url, "/api/story-workflow");
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(String(request.body)), { action: "trash", storyIds: ["story-1", "story-2"] });
    return Response.json({ stories: updated });
  });
  assert.deepEqual(await runStoryWorkflow("trash", ["story-1", "story-2"]), updated);
});

test("empty, partial, duplicate, unrelated or unchanged results never report a successful trash operation", async (t) => {
  const responses = [
    {}, { stories: null }, { stories: [] }, { stories: [null, null] },
    { stories: [story("story-1")] },
    { stories: [story("story-1"), story("story-1")] },
    { stories: [story("story-1"), story("other-story")] },
    { stories: [story("story-1"), story("story-2", "draft")] },
  ];
  let response: unknown;
  t.mock.method(globalThis, "fetch", async () => Response.json(response));
  for (response of responses) {
    await assert.rejects(runStoryWorkflow("trash", ["story-1", "story-2"]), /未能確認所有文章的狀態已更新/);
  }
});

test("restore, unpublish and publish require their expected final state", async (t) => {
  let status = "draft";
  t.mock.method(globalThis, "fetch", async () => Response.json({ stories: [story("story-1", status)] }));
  for (const action of ["restore", "unpublish", "publish"] as StoryWorkflowAction[]) {
    status = action === "publish" ? "published" : "draft";
    assert.equal((await runStoryWorkflow(action, ["story-1"]))[0].status, status);
    status = "trash";
    await assert.rejects(runStoryWorkflow(action, ["story-1"]), /未能確認/);
  }
});

test("failed trash requests preserve the API error and do not report success", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "文章狀態變更失敗，請稍後再試。" }, { status: 500 }));
  await assert.rejects(runStoryWorkflow("trash", ["story-1"]), /文章狀態變更失敗/);
});
