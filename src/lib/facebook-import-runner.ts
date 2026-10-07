import "server-only";
import { getFacebookPost, listFacebookPosts } from "./facebook-graph";
import { processFacebookImport, type FacebookImportAttempt, type FacebookImportDependencies, type FacebookImportRecord, type FacebookPost, type ImportedStory } from "./facebook-import";
import { getSupabaseServiceClient } from "./supabase-service";
import { FacebookImportError, facebookImportErrorReason, facebookSupabaseOperation, isFacebookAuthorizationError, logFacebookImportError, preserveFacebookImportFailure } from "./facebook-import-error";
import { orderFacebookStoryMedia } from "./facebook-attachments";

function safeMediaId(value: string) { return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 120); }
function cleanError(error: unknown) { return facebookImportErrorReason(error); }

async function loadStory(storyId: string): Promise<ImportedStory> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await facebookSupabaseOperation("stories.select", supabase.from("stories").select("id,source_id,status,title,body,published_at,title_confirmed,editorial_updated_at").eq("id", storyId).single());
  if (error) throw error;
  return { id: data.id, sourceId: data.source_id, status: data.status, title: data.title, body: data.body, publishedAt: data.published_at, titleConfirmed: data.title_confirmed, editorialUpdatedAt: data.editorial_updated_at };
}

function dependencies(): FacebookImportDependencies {
  const supabase = getSupabaseServiceClient();
  return {
    now: () => new Date(),
    async findImport(pageId, postId) {
      const { data, error } = await facebookSupabaseOperation("facebook_imports.select", supabase.from("facebook_imports").select("*").eq("page_id", pageId).eq("post_id", postId).maybeSingle());
      if (error) throw error;
      if (!data?.story_id) return null;
      return {
        id: data.id, pageId: data.page_id, postId: data.post_id, story: await loadStory(data.story_id), status: data.status,
        sourcePermalink: data.source_permalink || "", sourceCreatedAt: data.source_created_at, sourceUpdatedAt: data.source_updated_at,
        sourceSnapshot: data.source_snapshot, attemptCount: data.attempt_count, suggestedTaxonId: data.suggested_taxon_id,
        possibleDuplicateStoryId: data.possible_duplicate_story_id,
        attentionReason: data.attention_reason, importedPhotoIds: data.imported_photo_ids || [],
      } as FacebookImportRecord;
    },
    async createDraft(input) {
      const { data, error } = await facebookSupabaseOperation("stories.upsert", supabase.from("stories").upsert({
        source: "facebook", source_id: input.sourceId, title: input.title, body: input.body,
        published_at: input.publishedAt, status: "draft", title_confirmed: false, editorial_updated_at: null,
      }, { onConflict: "source_id" }).select("id,source_id,status,title,body,published_at,title_confirmed,editorial_updated_at").single());
      if (error) throw error;
      return { id: data.id, sourceId: data.source_id, status: data.status, title: data.title, body: data.body, publishedAt: data.published_at, titleConfirmed: data.title_confirmed, editorialUpdatedAt: data.editorial_updated_at };
    },
    async updateDraft(input) {
      const { id, ...updates } = input;
      const { data, error } = await facebookSupabaseOperation("stories.update", supabase.from("stories").update({
        title: updates.title, body: updates.body, published_at: updates.publishedAt,
        title_confirmed: updates.titleConfirmed, updated_at: new Date().toISOString(),
      }).eq("id", id).select("id,source_id,status,title,body,published_at,title_confirmed,editorial_updated_at").single());
      if (error) throw error;
      return { id: data.id, sourceId: data.source_id, status: data.status, title: data.title, body: data.body, publishedAt: data.published_at, titleConfirmed: data.title_confirmed, editorialUpdatedAt: data.editorial_updated_at };
    },
    async saveImport(record) {
      const { data, error } = await facebookSupabaseOperation("facebook_imports.upsert", supabase.from("facebook_imports").upsert({
        page_id: record.pageId, post_id: record.postId, story_id: record.story.id, status: record.status,
        source_permalink: record.sourcePermalink, source_created_at: record.sourceCreatedAt, source_updated_at: record.sourceUpdatedAt,
        source_snapshot: record.sourceSnapshot, suggested_taxon_id: record.suggestedTaxonId, attention_reason: record.attentionReason,
        possible_duplicate_story_id: record.possibleDuplicateStoryId ?? null,
        imported_photo_ids: record.importedPhotoIds, attempt_count: record.attemptCount, last_attempt_at: new Date().toISOString(),
        next_attempt_at: record.status === "failed" && record.attemptCount < 3 ? new Date(Date.now() + 5 * 60000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "page_id,post_id" }).select("id").single());
      if (error) throw error;
      return { ...record, id: data.id };
    },
    async savePendingSnapshot(record, post) {
      const { error } = await facebookSupabaseOperation("facebook_imports.update", supabase.from("facebook_imports").update({ pending_snapshot: post, updated_at: new Date().toISOString() }).eq("page_id", record.pageId).eq("post_id", record.postId));
      if (error) throw error;
    },
    async uploadPhoto(storyId, media) {
      if (!media.url) throw new Error("圖片沒有可下載網址");
      const response = await fetch(media.url, { cache: "no-store" });
      if (!response.ok) throw new FacebookImportError(`圖片下載失敗 (HTTP ${response.status})`, { operation: "download_photo", httpStatus: response.status });
      const contentType = response.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) throw new Error("下載內容不是圖片");
      const path = `facebook-live/${storyId}/${safeMediaId(media.sourceId)}.jpg`;
      const body = await response.arrayBuffer();
      const upload = await facebookSupabaseOperation("travel-photos.upload", supabase.storage.from("travel-photos").upload(path, body, { contentType, upsert: true }));
      if (upload.error) throw upload.error;
      const storagePath = `travel-photos/${path}`;
      const { data: prior } = await facebookSupabaseOperation("story_media.select", supabase.from("story_media").select("id").eq("story_id", storyId).eq("storage_path", storagePath).maybeSingle());
      if (!prior) {
        const { data: last } = await facebookSupabaseOperation("story_media.select", supabase.from("story_media").select("sort_order").eq("story_id", storyId).order("sort_order", { ascending: false }).limit(1).maybeSingle());
        try {
          await facebookSupabaseOperation("story_media.insert", supabase.from("story_media").insert({ story_id: storyId, kind: "photo", storage_path: storagePath, sort_order: last ? last.sort_order + 1 : 0, alt_text: media.altText || "Facebook 貼文圖片" }));
        } catch (error) {
          await preserveFacebookImportFailure(error, async () => {
            await facebookSupabaseOperation("travel-photos.remove", supabase.storage.from("travel-photos").remove([path]));
          });
          throw error;
        }
        await facebookSupabaseOperation("stories.update", supabase.from("stories").update({ cover_path: storagePath }).eq("id", storyId).is("cover_path", null));
      }
      return { storagePath };
    },
    async detachMissingPhotos(storyId, retainedSourceIds) {
      const prefix = `travel-photos/facebook-live/${storyId}/`;
      const retained = new Set(retainedSourceIds.map((id) => `${prefix}${safeMediaId(id)}.jpg`));
      const { data: rows, error } = await facebookSupabaseOperation("story_media.select", supabase.from("story_media").select("id,storage_path").eq("story_id", storyId).like("storage_path", `${prefix}%`));
      if (error) throw error;
      for (const row of rows || []) {
        if (retained.has(row.storage_path)) continue;
        const original = row.storage_path.replace("travel-photos/", "");
        const trashed = `facebook-trash/${storyId}/${Date.now()}-${original.split("/").at(-1)}`;
        const moved = await facebookSupabaseOperation("travel-photos.move", supabase.storage.from("travel-photos").move(original, trashed));
        if (moved.error) throw moved.error;
        try {
          await facebookSupabaseOperation("story_media.delete", supabase.from("story_media").delete().eq("id", row.id));
        } catch (error) {
          await preserveFacebookImportFailure(error, async () => {
            await facebookSupabaseOperation("travel-photos.move", supabase.storage.from("travel-photos").move(trashed, original));
          });
          throw error;
        }
        const { data: imported } = await facebookSupabaseOperation("facebook_imports.select", supabase.from("facebook_imports").select("id").eq("story_id", storyId).single());
        if (imported) await facebookSupabaseOperation("facebook_removed_media.insert", supabase.from("facebook_removed_media").insert({ import_id: imported.id, story_id: storyId, source_media_id: original.split("/").at(-1)?.replace(/\.jpg$/, "") || "unknown", original_storage_path: row.storage_path, trashed_storage_path: `travel-photos/${trashed}` }));
      }
      const { data: cover } = await facebookSupabaseOperation("story_media.select", supabase.from("story_media").select("storage_path").eq("story_id", storyId).eq("kind", "photo").order("sort_order").limit(1).maybeSingle());
      await facebookSupabaseOperation("stories.update", supabase.from("stories").update({ cover_path: cover?.storage_path || null, updated_at: new Date().toISOString() }).eq("id", storyId));
    },
    async syncPhotoOrder(storyId, sourceIds) {
      const { data, error } = await facebookSupabaseOperation("story_media.select", supabase.from("story_media").select("id,storage_path,sort_order,kind").eq("story_id", storyId).order("sort_order").order("id"));
      if (error) throw error;
      const ordered = orderFacebookStoryMedia(data || [], storyId, sourceIds);
      for (const [index, row] of ordered.entries()) {
        if (row.sort_order !== index) {
          await facebookSupabaseOperation("story_media.update", supabase.from("story_media").update({ sort_order: index }).eq("id", row.id).eq("story_id", storyId));
        }
      }
      const cover = ordered.find((row) => row.kind === "photo");
      if (cover) await facebookSupabaseOperation("stories.update", supabase.from("stories").update({ cover_path: cover.storage_path }).eq("id", storyId));
    },
    async suggestTaxon(text) {
      const normalized = text.toLocaleLowerCase("zh-TW");
      const { data } = await facebookSupabaseOperation("content_taxa.select", supabase.from("content_taxa").select("id,label,aliases,parent_id").eq("show_in_nav", true));
      const candidates = (data || []).filter((taxon) => [taxon.label, ...(taxon.aliases || [])].some((word) => word && normalized.includes(String(word).toLocaleLowerCase("zh-TW"))));
      candidates.sort((a, b) => Number(Boolean(b.parent_id)) - Number(Boolean(a.parent_id)));
      return candidates[0]?.id || null;
    },
    async findPossibleDuplicate(title, body) {
      const titleMatch = await facebookSupabaseOperation("stories.select", supabase.from("stories").select("id").eq("title", title).not("source_id", "like", "facebook-live:%").limit(1).maybeSingle());
      if (titleMatch.data?.id) return titleMatch.data.id;
      if (body.trim()) {
        const bodyMatch = await facebookSupabaseOperation("stories.select", supabase.from("stories").select("id").eq("body", body).not("source_id", "like", "facebook-live:%").limit(1).maybeSingle());
        if (bodyMatch.data?.id) return bodyMatch.data.id;
      }
      return null;
    },
    async recordAttempt(attempt: FacebookImportAttempt) {
      const { data: imported } = await facebookSupabaseOperation("facebook_imports.select", supabase.from("facebook_imports").select("id").eq("page_id", attempt.pageId).eq("post_id", attempt.postId).maybeSingle());
      const { error } = await facebookSupabaseOperation("facebook_import_attempts.insert", supabase.from("facebook_import_attempts").insert({
        import_id: imported?.id || null, page_id: attempt.pageId, post_id: attempt.postId,
        attempt_number: attempt.attemptNumber, outcome: attempt.outcome, stage: attempt.stage,
        error_code: attempt.errorCode, error_reason: attempt.errorReason, started_at: attempt.startedAt, finished_at: attempt.finishedAt,
      }));
      if (error) throw error;
    },
  };
}

export async function runFacebookImport(post: FacebookPost, force = false, overrideEditorial = false) {
  try {
    const result = await processFacebookImport(post, dependencies(), { force, overrideEditorial });
    const prefix = `travel-photos/facebook-live/${result.story.id}/`;
    const { data: stored } = await facebookSupabaseOperation("story_media.select", getSupabaseServiceClient().from("story_media").select("storage_path").eq("story_id", result.story.id).eq("kind", "photo").like("storage_path", `${prefix}%`));
    const requested = new Set(post.media.filter((item) => item.type === "photo").map((item) => `${prefix}${safeMediaId(item.sourceId)}.jpg`));
    console.info("Facebook draft images", {
      postId: post.postId, storyId: result.story.id, status: result.status,
      parsedImageCount: post.media.filter((item) => item.type === "photo" && item.url).length,
      writtenImageCount: (stored || []).filter((row) => requested.has(row.storage_path)).length,
      storedFacebookImageCount: stored?.length || 0,
    });
    await facebookSupabaseOperation("facebook_sync_settings.update", getSupabaseServiceClient().from("facebook_sync_settings").update({ last_success_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("singleton", true));
    return result;
  } catch (error) {
    logFacebookImportError("process_post", error, { pageId: post.pageId, postId: post.postId });
    await preserveFacebookImportFailure(error, async () => {
      const supabase = getSupabaseServiceClient();
      const reason = cleanError(error);
      const { data: prior } = await facebookSupabaseOperation("facebook_imports.select", supabase.from("facebook_imports").select("id,attempt_count").eq("page_id", post.pageId).eq("post_id", post.postId).maybeSingle());
      const attempt = (prior?.attempt_count || 0) + 1;
      const { data: imported } = await facebookSupabaseOperation("facebook_imports.upsert", supabase.from("facebook_imports").upsert({ page_id: post.pageId, post_id: post.postId, status: "failed", attempt_count: attempt, attention_reason: reason, last_attempt_at: new Date().toISOString(), next_attempt_at: attempt < 3 ? new Date(Date.now() + 5 * 60000).toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "page_id,post_id" }).select("id").single());
      await facebookSupabaseOperation("facebook_import_attempts.insert", supabase.from("facebook_import_attempts").insert({ import_id: imported?.id || null, page_id: post.pageId, post_id: post.postId, attempt_number: attempt, outcome: "failed", stage: "processing", error_code: "IMPORT_FAILED", error_reason: reason, started_at: new Date().toISOString(), finished_at: new Date().toISOString() }));
      const interrupted = isFacebookAuthorizationError(error);
      await facebookSupabaseOperation("facebook_sync_settings.update", supabase.from("facebook_sync_settings").update({ ...(interrupted ? { state: "interrupted" } : {}), last_error: reason, updated_at: new Date().toISOString() }).eq("singleton", true));
    });
    throw error;
  }
}

async function recordFacebookFetchFailure(pageId: string, postId: string, error: unknown) {
  const supabase = getSupabaseServiceClient();
  const reason = cleanError(error);
  const { data: prior } = await facebookSupabaseOperation("facebook_imports.select", supabase.from("facebook_imports").select("attempt_count").eq("page_id", pageId).eq("post_id", postId).maybeSingle());
  const attempt = (prior?.attempt_count || 0) + 1;
  const { data: imported } = await facebookSupabaseOperation("facebook_imports.upsert", supabase.from("facebook_imports").upsert({ page_id: pageId, post_id: postId, status: "failed", attempt_count: attempt, attention_reason: reason, last_attempt_at: new Date().toISOString(), next_attempt_at: attempt < 3 ? new Date(Date.now() + 5 * 60000).toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "page_id,post_id" }).select("id").single());
  await facebookSupabaseOperation("facebook_import_attempts.insert", supabase.from("facebook_import_attempts").insert({ import_id: imported?.id || null, page_id: pageId, post_id: postId, attempt_number: attempt, outcome: "failed", stage: "fetch_post", error_code: "GRAPH_FETCH_FAILED", error_reason: reason, started_at: new Date().toISOString(), finished_at: new Date().toISOString() }));
  const interrupted = isFacebookAuthorizationError(error);
  await facebookSupabaseOperation("facebook_sync_settings.update", supabase.from("facebook_sync_settings").update({ ...(interrupted ? { state: "interrupted" } : {}), last_error: reason, updated_at: new Date().toISOString() }).eq("singleton", true));
}

async function fetchFacebookPostForImport(postId: string) {
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim() || "unknown-page";
  try {
    return await getFacebookPost(postId);
  } catch (error) {
    logFacebookImportError("fetch_post", error, { pageId, postId });
    await preserveFacebookImportFailure(error, () => recordFacebookFetchFailure(pageId, postId, error));
    throw error;
  }
}

export async function importFacebookPostById(postId: string, force = false, overrideEditorial = false) {
  return runFacebookImport(await fetchFacebookPostForImport(postId), force, overrideEditorial);
}

export async function enqueueFacebookChange(pageId: string, postId: string, kind: "upsert" | "remove", receivedAt = Date.now()) {
  const { data, error } = await facebookSupabaseOperation("facebook_import_events.insert", getSupabaseServiceClient().from("facebook_import_events").insert({ page_id: pageId, post_id: postId, kind, received_at: new Date(receivedAt).toISOString() }).select("id").single());
  if (error) throw error;
  return data.id as number;
}

export async function processFacebookEvent(eventId: number) {
  const supabase = getSupabaseServiceClient();
  const { data: event } = await facebookSupabaseOperation("claim_facebook_import_event.rpc", supabase.rpc("claim_facebook_import_event", { p_event_id: eventId }));
  if (!event?.id) return;
  try {
    if (event.kind === "remove") {
      const { data: known } = await facebookSupabaseOperation("facebook_imports.select", supabase.from("facebook_imports").select("id").eq("page_id", event.page_id).eq("post_id", event.post_id).maybeSingle());
      if (!known) {
        await facebookSupabaseOperation("facebook_import_events.update", supabase.from("facebook_import_events").update({ status: "completed", last_error: null, updated_at: new Date().toISOString() }).eq("id", eventId));
        return;
      }
    }
    const post = event.kind === "remove"
      ? { pageId: event.page_id, postId: event.post_id, message: "", createdTime: event.received_at, updatedTime: event.received_at, permalinkUrl: "", media: [], removed: true } satisfies FacebookPost
      : null;
    if (!post) {
      await importFacebookPostById(event.post_id);
    } else {
      await runFacebookImport(post);
    }
    await facebookSupabaseOperation("facebook_import_events.update", supabase.from("facebook_import_events").update({ status: "completed", last_error: null, updated_at: new Date().toISOString() }).eq("id", eventId));
  } catch (error) {
    logFacebookImportError("process_event", error, { eventId });
    await preserveFacebookImportFailure(error, async () => {
      await facebookSupabaseOperation("facebook_import_events.update", supabase.from("facebook_import_events").update({ status: "failed", last_error: cleanError(error), updated_at: new Date().toISOString() }).eq("id", eventId));
    });
  }
}

export async function retryFacebookEventQueue() {
  const supabase = getSupabaseServiceClient();
  const staleBefore = new Date(Date.now() - 10 * 60000).toISOString();
  await facebookSupabaseOperation("facebook_import_events.update", supabase.from("facebook_import_events").update({ status: "failed", last_error: "前次處理逾時，已重新排入 queue", updated_at: new Date().toISOString() }).eq("status", "processing").lt("updated_at", staleBefore));
  const { data, error } = await facebookSupabaseOperation("facebook_import_events.select", supabase.from("facebook_import_events").select("id").in("status", ["pending", "failed"]).lt("attempt_count", 3).order("received_at").limit(50));
  if (error) throw error;
  for (const event of data || []) await processFacebookEvent(event.id);
  return data?.length || 0;
}

export async function reconcileFacebookImports() {
  const supabase = getSupabaseServiceClient();
  const { data: settings } = await facebookSupabaseOperation("facebook_sync_settings.select", supabase.from("facebook_sync_settings").select("*").eq("singleton", true).single());
  if (!settings || settings.state !== "active" || !settings.activated_at) throw new Error("Facebook 自動匯入尚未啟用。");
  let posts: FacebookPost[];
  try { posts = await listFacebookPosts(settings.activated_at); }
  catch (error) {
    logFacebookImportError("list_posts", error);
    const reason = cleanError(error);
    const interrupted = isFacebookAuthorizationError(error);
    await preserveFacebookImportFailure(error, async () => {
      await facebookSupabaseOperation("facebook_sync_settings.update", supabase.from("facebook_sync_settings").update({ ...(interrupted ? { state: "interrupted" } : {}), last_error: reason, updated_at: new Date().toISOString() }).eq("singleton", true));
    });
    throw error;
  }
  const { data: priorImports } = await facebookSupabaseOperation("facebook_imports.select", supabase.from("facebook_imports").select("post_id,status,attempt_count,attention_reason").in("status", ["failed", "needs_attention"]));
  const priorByPost = new Map((priorImports || []).map((item) => [item.post_id, item]));
  for (const post of posts) {
    const prior = priorByPost.get(post.postId);
    if (prior?.status === "failed" && prior.attempt_count >= 3) continue;
    const retryPhotos = prior?.status === "needs_attention" && prior.attempt_count < 3 && /圖片/.test(prior.attention_reason || "");
    await runFacebookImport(post, retryPhotos);
  }
  await facebookSupabaseOperation("facebook_sync_settings.update", supabase.from("facebook_sync_settings").update({ last_checked_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("singleton", true));
  return posts.length;
}

export async function retryFacebookImport(postId: string) { return importFacebookPostById(postId, true); }
export async function applyLatestFacebookImport(postId: string) {
  const supabase = getSupabaseServiceClient();
  const post = await fetchFacebookPostForImport(postId);
  const { data: imported } = await facebookSupabaseOperation("facebook_imports.select", supabase.from("facebook_imports").select("story_id").eq("page_id", post.pageId).eq("post_id", post.postId).maybeSingle());
  const original = imported?.story_id
    ? await facebookSupabaseOperation("stories.select", supabase.from("stories").select("id,status,title,body,published_at,title_confirmed,editorial_updated_at").eq("id", imported.story_id).single())
    : null;
  if (original?.error) throw original.error;
  if (original?.data.status === "published") {
    const unpublished = await facebookSupabaseOperation("stories.update", supabase.from("stories").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", original.data.id).eq("status", "published"));
    if (unpublished.error) throw unpublished.error;
  }
  try {
    return await runFacebookImport(post, true, true);
  } catch (error) {
    if (original?.data) {
      await preserveFacebookImportFailure(error, async () => {
        await facebookSupabaseOperation("stories.update", supabase.from("stories").update({
          status: original.data.status, title: original.data.title, body: original.data.body,
          published_at: original.data.published_at, title_confirmed: original.data.title_confirmed,
          editorial_updated_at: original.data.editorial_updated_at, updated_at: new Date().toISOString(),
        }).eq("id", original.data.id));
      });
    }
    throw error;
  }
}
