export type FacebookImportStatus = "pending" | "processing" | "succeeded" | "needs_attention" | "failed" | "update_pending" | "source_removed";
export type FacebookMedia = { sourceId: string; type: "photo" | "video" | "reel" | "live" | "shared"; url?: string; altText?: string };
export type FacebookPost = {
  pageId: string;
  postId: string;
  message: string;
  createdTime: string;
  updatedTime: string;
  permalinkUrl: string;
  media: FacebookMedia[];
  removed?: boolean;
};

export type ImportedStory = {
  id: string;
  sourceId: string;
  status: "draft" | "published" | "trash";
  title: string;
  body: string;
  publishedAt: string;
  titleConfirmed: boolean;
  editorialUpdatedAt: string | null;
};

export type FacebookImportRecord = {
  id?: string;
  pageId: string;
  postId: string;
  story: ImportedStory;
  status: FacebookImportStatus;
  sourcePermalink: string;
  sourceCreatedAt: string;
  sourceUpdatedAt: string;
  sourceSnapshot: FacebookPost;
  attemptCount: number;
  suggestedTaxonId: string | null;
  possibleDuplicateStoryId?: string | null;
  attentionReason: string | null;
  importedPhotoIds: string[];
};

export type FacebookImportAttempt = {
  pageId: string;
  postId: string;
  attemptNumber: number;
  outcome: "succeeded" | "needs_attention" | "failed" | "update_pending" | "source_removed";
  stage: string;
  errorCode: string | null;
  errorReason: string | null;
  startedAt: string;
  finishedAt: string;
};

export type FacebookImportDependencies = {
  now(): Date;
  findImport(pageId: string, postId: string): Promise<FacebookImportRecord | null>;
  createDraft(input: Omit<ImportedStory, "id" | "status" | "editorialUpdatedAt">): Promise<ImportedStory>;
  updateDraft(input: Partial<Omit<ImportedStory, "id">> & { id: string }): Promise<ImportedStory>;
  saveImport(record: FacebookImportRecord): Promise<FacebookImportRecord>;
  savePendingSnapshot(record: FacebookImportRecord, post: FacebookPost): Promise<void>;
  uploadPhoto(storyId: string, media: FacebookMedia): Promise<{ storagePath: string }>;
  detachMissingPhotos(storyId: string, retainedSourceIds: string[]): Promise<void>;
  suggestTaxon(text: string): Promise<string | null>;
  findPossibleDuplicate?(title: string, body: string): Promise<string | null>;
  recordAttempt(attempt: FacebookImportAttempt): Promise<void>;
};

export type FacebookImportResult = { status: FacebookImportStatus; story: ImportedStory; attentionReason: string | null };

function provisionalTitle(message: string, createdTime: string) {
  const usefulLine = message.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !/^https?:\/\/\S+$/i.test(line) && !/^(?:#\S+\s*)+$/.test(line));
  if (!usefulLine) return `Facebook 貼文｜${createdTime.slice(0, 10)}`;
  const firstSentence = usefulLine.match(/^.*?[。！？!?](?=\s|$|[^。！？!?])/u)?.[0] ?? usefulLine;
  return firstSentence.length > 80 ? `${firstSentence.slice(0, 79)}…` : firstSentence;
}

function withoutTrackingParameters(message: string) {
  return message.replace(/https?:\/\/[^\s]+/gi, (value) => {
    try {
      const url = new URL(value);
      for (const key of [...url.searchParams.keys()]) if (key === "fbclid" || key.startsWith("utm_")) url.searchParams.delete(key);
      return url.toString();
    } catch { return value; }
  });
}

function safeFailureReason(error: unknown) {
  return (error instanceof Error ? error.message : "未知錯誤").replace(/(access_token|token|secret)=[^\s&]+/gi, "$1=[redacted]").slice(0, 300);
}

export async function processFacebookImport(post: FacebookPost, dependencies: FacebookImportDependencies, options: { force?: boolean; overrideEditorial?: boolean } = {}): Promise<FacebookImportResult> {
  const startedAt = dependencies.now().toISOString();
  const message = withoutTrackingParameters(post.message);
  const existing = await dependencies.findImport(post.pageId, post.postId);
  if (existing && existing.sourceUpdatedAt === post.updatedTime && !post.removed && !options.force && (existing.status === "succeeded" || existing.status === "needs_attention" || existing.status === "update_pending")) {
    const unchanged = { ...existing, attemptCount: existing.attemptCount + 1 };
    await dependencies.saveImport(unchanged);
    await dependencies.recordAttempt({
      pageId: post.pageId, postId: post.postId, attemptNumber: unchanged.attemptCount,
      outcome: existing.status,
      stage: "unchanged", errorCode: null, errorReason: null,
      startedAt, finishedAt: dependencies.now().toISOString(),
    });
    return { status: existing.status, story: existing.story, attentionReason: existing.attentionReason };
  }
  if (existing && post.removed) {
    const removed = {
      ...existing, status: "source_removed" as const,
      attemptCount: existing.attemptCount + 1,
      attentionReason: "Facebook 原文已移除",
    };
    await dependencies.saveImport(removed);
    await dependencies.recordAttempt({
      pageId: post.pageId, postId: post.postId, attemptNumber: removed.attemptCount,
      outcome: "source_removed", stage: "source_removed", errorCode: null, errorReason: null,
      startedAt, finishedAt: dependencies.now().toISOString(),
    });
    return { status: removed.status, story: existing.story, attentionReason: removed.attentionReason };
  }
  if (existing && (existing.story.editorialUpdatedAt || existing.story.status === "published") && !options.overrideEditorial) {
    const attemptNumber = existing.attemptCount + 1;
    const pending = { ...existing, status: "update_pending" as const, attemptCount: attemptNumber, attentionReason: "Facebook 原文已有更新，等待作者確認" };
    await dependencies.savePendingSnapshot(pending, post);
    await dependencies.saveImport(pending);
    await dependencies.recordAttempt({
      pageId: post.pageId, postId: post.postId, attemptNumber, outcome: "update_pending",
      stage: "editorial_conflict", errorCode: null, errorReason: null,
      startedAt, finishedAt: dependencies.now().toISOString(),
    });
    return { status: pending.status, story: existing.story, attentionReason: pending.attentionReason };
  }
  if (existing) {
    const story = await dependencies.updateDraft({
      id: existing.story.id,
      title: provisionalTitle(message, post.createdTime),
      body: message,
      publishedAt: post.createdTime,
      titleConfirmed: false,
    });
    const photoIds = post.media.filter((item) => item.type === "photo").map((item) => item.sourceId);
    const importedPhotoIds = existing.importedPhotoIds.filter((id) => photoIds.includes(id));
    const attention: string[] = [];
    for (const media of post.media) {
      if (media.type !== "photo") {
        attention.push(media.type === "video" ? "Facebook 影片需人工處理" : "Facebook 不支援的媒體需人工處理");
      } else if (!importedPhotoIds.includes(media.sourceId)) {
        try {
          await dependencies.uploadPhoto(story.id, media);
          importedPhotoIds.push(media.sourceId);
        } catch (error) {
          attention.push(`圖片 ${media.sourceId} 匯入失敗：${safeFailureReason(error)}`);
        }
      }
    }
    await dependencies.detachMissingPhotos(story.id, photoIds);
    const status: FacebookImportStatus = attention.length ? "needs_attention" : "succeeded";
    const attentionReason = [...new Set(attention)].join("；") || null;
    const updated: FacebookImportRecord = {
      ...existing, story, status, sourcePermalink: post.permalinkUrl,
      sourceUpdatedAt: post.updatedTime, sourceSnapshot: post,
      attemptCount: existing.attemptCount + 1,
      suggestedTaxonId: await dependencies.suggestTaxon(message),
      attentionReason, importedPhotoIds,
    };
    await dependencies.saveImport(updated);
    await dependencies.recordAttempt({
      pageId: post.pageId, postId: post.postId, attemptNumber: updated.attemptCount,
      outcome: status, stage: attentionReason ? "media" : "complete", errorCode: attentionReason ? "MEDIA_NEEDS_ATTENTION" : null, errorReason: attentionReason,
      startedAt, finishedAt: dependencies.now().toISOString(),
    });
    return { status, story, attentionReason };
  }

  const title = provisionalTitle(message, post.createdTime);
  const possibleDuplicateStoryId = await dependencies.findPossibleDuplicate?.(title, message) ?? null;
  const story = await dependencies.createDraft({
    sourceId: `facebook-live:${post.pageId}:${post.postId}`,
    title,
    body: message,
    publishedAt: post.createdTime,
    titleConfirmed: false,
  });
  const suggestedTaxonId = await dependencies.suggestTaxon(message);
  const importedPhotoIds: string[] = [];
  const attention: string[] = [];
  for (const media of post.media) {
    if (media.type !== "photo") {
      attention.push(media.type === "video" ? "Facebook 影片需人工處理" : "Facebook 不支援的媒體需人工處理");
      continue;
    }
    try {
      await dependencies.uploadPhoto(story.id, media);
      importedPhotoIds.push(media.sourceId);
    } catch (error) {
      attention.push(`圖片 ${media.sourceId} 匯入失敗：${safeFailureReason(error)}`);
    }
  }
  const status: FacebookImportStatus = attention.length ? "needs_attention" : "succeeded";
  const attentionReason = [...new Set(attention)].join("；") || null;
  const record: FacebookImportRecord = {
    pageId: post.pageId,
    postId: post.postId,
    story,
    status,
    sourcePermalink: post.permalinkUrl,
    sourceCreatedAt: post.createdTime,
    sourceUpdatedAt: post.updatedTime,
    sourceSnapshot: post,
    attemptCount: 1,
    suggestedTaxonId,
    possibleDuplicateStoryId,
    attentionReason,
    importedPhotoIds,
  };
  await dependencies.saveImport(record);
  await dependencies.recordAttempt({
    pageId: post.pageId,
    postId: post.postId,
    attemptNumber: 1,
    outcome: status,
    stage: attentionReason ? "media" : "complete",
    errorCode: attentionReason ? "MEDIA_NEEDS_ATTENTION" : null,
    errorReason: attentionReason,
    startedAt,
    finishedAt: dependencies.now().toISOString(),
  });
  return { status: record.status, story, attentionReason };
}
