import assert from "node:assert/strict";
import test from "node:test";
import {
  processFacebookImport,
  type FacebookImportDependencies,
  type FacebookImportRecord,
  type FacebookPost,
  type ImportedStory,
} from "../src/lib/facebook-import.ts";

function createHarness(overrides: Partial<FacebookImportDependencies> = {}) {
  let current: FacebookImportRecord | null = null;
  let story: ImportedStory | null = null;
  const attempts: Parameters<FacebookImportDependencies["recordAttempt"]>[0][] = [];
  const dependencies: FacebookImportDependencies = {
    now: () => new Date("2026-08-13T10:00:00.000Z"),
    findImport: async () => current,
    createDraft: async (input) => {
      story = { id: "story-1", status: "draft", editorialUpdatedAt: null, ...input };
      return story;
    },
    updateDraft: async (input) => {
      if (!story) throw new Error("story missing");
      story = { ...story, ...input };
      return story;
    },
    saveImport: async (input) => {
      current = input;
      return input;
    },
    savePendingSnapshot: async () => undefined,
    uploadPhoto: async () => ({ storagePath: "travel-photos/facebook/example.jpg" }),
    detachMissingPhotos: async () => undefined,
    suggestTaxon: async () => null,
    recordAttempt: async (attempt) => { attempts.push(attempt); },
    ...overrides,
  };
  return { dependencies, attempts, getStory: () => story, getImport: () => current };
}

test("new Facebook text post becomes an unpublished draft with its source date", async () => {
  const harness = createHarness();
  const result = await processFacebookImport({
    pageId: "page-1",
    postId: "page-1_42",
    message: "首爾 Day 1：抵達韓國！\n今天先去吃烤肉。",
    createdTime: "2026-08-12T03:04:05.000Z",
    updatedTime: "2026-08-12T03:04:05.000Z",
    permalinkUrl: "https://www.facebook.com/page-1/posts/42",
    media: [],
  }, harness.dependencies);

  assert.equal(result.status, "succeeded");
  assert.equal(result.story.status, "draft");
  assert.equal(result.story.sourceId, "facebook-live:page-1:page-1_42");
  assert.equal(result.story.title, "首爾 Day 1：抵達韓國！");
  assert.equal(result.story.body, "首爾 Day 1：抵達韓國！\n今天先去吃烤肉。");
  assert.equal(result.story.publishedAt, "2026-08-12T03:04:05.000Z");
  assert.equal(result.story.titleConfirmed, false);
  assert.equal(harness.attempts.at(-1)?.outcome, "succeeded");
});

test("a repeated unchanged webhook reuses the same draft and records an idempotent success", async () => {
  const harness = createHarness();
  const post: FacebookPost = {
    pageId: "page-1", postId: "page-1_42", message: "柏林散步",
    createdTime: "2026-08-12T03:04:05.000Z", updatedTime: "2026-08-12T03:04:05.000Z",
    permalinkUrl: "https://www.facebook.com/page-1/posts/42", media: [],
  };
  const first = await processFacebookImport(post, harness.dependencies);
  const second = await processFacebookImport(post, harness.dependencies);

  assert.equal(second.story.id, first.story.id);
  assert.equal(second.status, "succeeded");
  assert.equal(harness.attempts.length, 2);
  assert.equal(harness.attempts.at(-1)?.stage, "unchanged");
});

test("photos are imported while unsupported video leaves a visible needs-attention result", async () => {
  const harness = createHarness();
  const result = await processFacebookImport({
    pageId: "page-1", postId: "page-1_99", message: "旅行影片與照片",
    createdTime: "2026-08-12T03:04:05.000Z", updatedTime: "2026-08-12T03:04:05.000Z",
    permalinkUrl: "https://www.facebook.com/page-1/posts/99",
    media: [
      { sourceId: "photo-1", type: "photo", url: "https://example.com/photo.jpg" },
      { sourceId: "video-1", type: "video", url: "https://example.com/video.mp4" },
    ],
  }, harness.dependencies);

  assert.equal(result.status, "needs_attention");
  assert.match(result.attentionReason ?? "", /影片/);
  assert.deepEqual(harness.getImport()?.importedPhotoIds, ["photo-1"]);
  assert.equal(harness.attempts.at(-1)?.outcome, "needs_attention");
});

test("a Facebook edit never overwrites a draft already saved by an author", async () => {
  const existingStory: ImportedStory = {
    id: "story-existing", sourceId: "facebook-live:page-1:page-1_42", status: "draft",
    title: "作者整理過的標題", body: "作者整理過的內文", publishedAt: "2026-08-10T00:00:00.000Z",
    titleConfirmed: true, editorialUpdatedAt: "2026-08-11T00:00:00.000Z",
  };
  const existing: FacebookImportRecord = {
    pageId: "page-1", postId: "page-1_42", story: existingStory, status: "succeeded",
    sourcePermalink: "https://www.facebook.com/page-1/posts/42",
    sourceCreatedAt: "2026-08-10T00:00:00.000Z", sourceUpdatedAt: "2026-08-10T00:00:00.000Z",
    sourceSnapshot: { pageId: "page-1", postId: "page-1_42", message: "舊原文", createdTime: "2026-08-10T00:00:00.000Z", updatedTime: "2026-08-10T00:00:00.000Z", permalinkUrl: "https://www.facebook.com/page-1/posts/42", media: [] },
    attemptCount: 1, suggestedTaxonId: null, attentionReason: null, importedPhotoIds: [],
  };
  const harness = createHarness({ findImport: async () => existing });
  const result = await processFacebookImport({
    ...existing.sourceSnapshot, message: "Facebook 更新後的文字", updatedTime: "2026-08-12T00:00:00.000Z",
  }, harness.dependencies);

  assert.equal(result.status, "update_pending");
  assert.equal(result.story.title, "作者整理過的標題");
  assert.equal(result.story.body, "作者整理過的內文");
  assert.equal(harness.attempts.at(-1)?.outcome, "update_pending");
});

test("an untouched import draft follows a newer Facebook version", async () => {
  const existingStory: ImportedStory = {
    id: "story-existing", sourceId: "facebook-live:page-1:page-1_42", status: "draft",
    title: "舊標題", body: "舊原文", publishedAt: "2026-08-10T00:00:00.000Z",
    titleConfirmed: false, editorialUpdatedAt: null,
  };
  const existing: FacebookImportRecord = {
    pageId: "page-1", postId: "page-1_42", story: existingStory, status: "succeeded",
    sourcePermalink: "https://www.facebook.com/page-1/posts/42",
    sourceCreatedAt: "2026-08-10T00:00:00.000Z", sourceUpdatedAt: "2026-08-10T00:00:00.000Z",
    sourceSnapshot: { pageId: "page-1", postId: "page-1_42", message: "舊原文", createdTime: "2026-08-10T00:00:00.000Z", updatedTime: "2026-08-10T00:00:00.000Z", permalinkUrl: "https://www.facebook.com/page-1/posts/42", media: [] },
    attemptCount: 1, suggestedTaxonId: null, attentionReason: null, importedPhotoIds: [],
  };
  const harness = createHarness({
    findImport: async () => existing,
    updateDraft: async (input) => ({ ...existingStory, ...input }),
  });
  const result = await processFacebookImport({
    ...existing.sourceSnapshot, message: "新標題！\n更新後的原文", updatedTime: "2026-08-12T00:00:00.000Z",
  }, harness.dependencies);

  assert.equal(result.story.id, "story-existing");
  assert.equal(result.story.title, "新標題！");
  assert.equal(result.story.body, "新標題！\n更新後的原文");
  assert.equal(result.status, "succeeded");
});

test("a removed Facebook source is marked without deleting its website story", async () => {
  const story: ImportedStory = {
    id: "story-existing", sourceId: "facebook-live:page-1:page-1_42", status: "published",
    title: "網站仍保留的文章", body: "內容", publishedAt: "2026-08-10T00:00:00.000Z",
    titleConfirmed: true, editorialUpdatedAt: "2026-08-11T00:00:00.000Z",
  };
  const existing: FacebookImportRecord = {
    pageId: "page-1", postId: "page-1_42", story, status: "succeeded",
    sourcePermalink: "https://www.facebook.com/page-1/posts/42",
    sourceCreatedAt: "2026-08-10T00:00:00.000Z", sourceUpdatedAt: "2026-08-10T00:00:00.000Z",
    sourceSnapshot: { pageId: "page-1", postId: "page-1_42", message: "內容", createdTime: "2026-08-10T00:00:00.000Z", updatedTime: "2026-08-10T00:00:00.000Z", permalinkUrl: "https://www.facebook.com/page-1/posts/42", media: [] },
    attemptCount: 1, suggestedTaxonId: null, attentionReason: null, importedPhotoIds: [],
  };
  const harness = createHarness({ findImport: async () => existing });
  const result = await processFacebookImport({ ...existing.sourceSnapshot, removed: true }, harness.dependencies);

  assert.equal(result.status, "source_removed");
  assert.equal(result.story.status, "published");
  assert.equal(result.story.title, "網站仍保留的文章");
  assert.equal(harness.attempts.at(-1)?.outcome, "source_removed");
});

test("a matching existing story is only suggested as a duplicate and never merged automatically", async () => {
  const harness = createHarness({ findPossibleDuplicate: async () => "existing-story" });
  const result = await processFacebookImport({
    pageId: "page-1", postId: "page-1_88", message: "相同標題",
    createdTime: "2026-08-12T00:00:00.000Z", updatedTime: "2026-08-12T00:00:00.000Z",
    permalinkUrl: "https://www.facebook.com/page-1/posts/88", media: [],
  }, harness.dependencies);
  assert.equal(result.story.id, "story-1");
  assert.equal(harness.getImport()?.possibleDuplicateStoryId, "existing-story");
});

test("imported text keeps ordinary links but removes known tracking parameters", async () => {
  const harness = createHarness();
  const result = await processFacebookImport({
    pageId: "page-1", postId: "page-1_77",
    message: "旅行連結 https://example.com/guide?place=seoul&utm_source=facebook&fbclid=secret#day1",
    createdTime: "2026-08-12T00:00:00.000Z", updatedTime: "2026-08-12T00:00:00.000Z",
    permalinkUrl: "https://www.facebook.com/page-1/posts/77", media: [],
  }, harness.dependencies);
  assert.equal(result.story.body, "旅行連結 https://example.com/guide?place=seoul#day1");
});
