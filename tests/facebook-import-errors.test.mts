import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test, { type TestContext } from "node:test";
import {
  FacebookImportError, facebookImportErrorDetails, facebookImportErrorReason,
  facebookSupabaseOperation, isFacebookAuthorizationError,
} from "../src/lib/facebook-import-error.ts";

// Only this test worker replaces server-only and the database/auth adapters.
// Graph requests, the runner, and the POST handler execute their real code.
const dbKey = Symbol.for("facebook-import-test-db");
const globals = globalThis as typeof globalThis & { [dbKey]: unknown };
const dataModule = (code: string) => `data:text/javascript,${encodeURIComponent(code)}`;
// The app still uses @types/node 20; this test runs on Node 22.20+.
type ResolveResult = { url: string; shortCircuit?: boolean };
type ResolveContext = { parentURL?: string };
const { registerHooks } = nodeModule as typeof nodeModule & {
  registerHooks(hooks: { resolve(specifier: string, context: ResolveContext, nextResolve: (specifier: string, context: ResolveContext) => ResolveResult): ResolveResult }): unknown;
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: dataModule("export {};"), shortCircuit: true };
    if (specifier.endsWith("supabase-service")) return {
      url: dataModule('export function getSupabaseServiceClient() { return globalThis[Symbol.for("facebook-import-test-db")]; }'), shortCircuit: true,
    };
    if (specifier.endsWith("author-access")) return {
      url: dataModule('export async function getAuthorContext() { return {supabase: globalThis[Symbol.for("facebook-import-test-db")]}; }'), shortCircuit: true,
    };
    if (specifier.endsWith("api-error")) return {
      url: dataModule('export function apiError() { throw new Error("Unexpected GET error helper"); }'), shortCircuit: true,
    };
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    if (specifier.startsWith("./facebook-") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const graph = await import("../src/lib/facebook-graph.ts");
const runner = await import("../src/lib/facebook-import-runner.ts");
const route = await import("../src/app/api/facebook-import/route.ts");

const postId = "389930330864242_122203917908429018";
const pageId = "389930330864242";
const graphPost = { id: postId, message: "測試貼文", created_time: "2026-10-06T12:00:00+0000", from: { id: pageId } };
const post = { pageId, postId, message: "測試貼文", createdTime: graphPost.created_time, updatedTime: graphPost.created_time, permalinkUrl: "https://www.facebook.com/" + postId, media: [] };
type Query = { table: string; operation: string; input?: unknown; columns?: string; single?: boolean; filters: Record<string, unknown> };
type Result = { data: unknown; error: unknown; status: number };
function database(resultFor: (query: Query) => Result) {
  return { from(table: string) {
    const state: Query = { table, operation: "select", filters: {} };
    const chain = new Proxy({}, { get(_target, key) {
      if (key === "then") return (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(resultFor(state)).then(resolve, reject);
      return (...args: unknown[]) => {
        if (["upsert", "insert", "update", "delete"].includes(String(key))) { state.operation = String(key); state.input = args[0]; }
        if (key === "select") state.columns = String(args[0]);
        if (key === "eq" || key === "like") state.filters[String(args[0])] = args[1];
        if (key === "single" || key === "maybeSingle") state.single = true;
        return chain;
      };
    } });
    return chain;
  } };
}
const ok = (data: unknown): Result => ({ data, error: null, status: 200 });
function successfulDatabase(query: Query): Result {
  if (query.table === "stories" && query.operation === "upsert") return ok({ id: "story-1", source_id: `facebook-live:${pageId}:${postId}`, status: "draft", title: "測試貼文", body: "測試貼文", published_at: post.createdTime, title_confirmed: false, editorial_updated_at: null });
  if (query.table === "facebook_imports" && query.operation === "upsert") return ok({ id: "import-1" });
  if (query.table === "content_taxa") return ok([]);
  return ok(null);
}
const denied = { code: "42501", message: "permission denied for table facebook_imports", details: null, hint: "GRANT SELECT ON public.facebook_imports TO service_role;" };
const failure = { error: { message: "Token expired", code: 190, error_subcode: 463, fbtrace_id: "trace-1" } };
const errorLogs: unknown[][] = [];
const infoLogs: unknown[][] = [];

test.beforeEach((context) => {
  const t = context as TestContext;
  const old = { ...process.env };
  process.env.FACEBOOK_PAGE_ID = pageId;
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "test-page-token";
  process.env.FACEBOOK_GRAPH_API_VERSION = "v24.0";
  t.after(() => { process.env = old; });
  globals[dbKey] = database(successfulDatabase);
  errorLogs.length = 0;
  infoLogs.length = 0;
  t.mock.method(console, "error", (...args: unknown[]) => { errorLogs.push(args); });
  t.mock.method(console, "info", (...args: unknown[]) => { infoLogs.push(args); });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => Response.json(String(input).includes(postId) ? graphPost : { id: pageId, name: "Test Page" }));
});

test("Supabase plain objects preserve message, code, status, hint, and a stack", async () => {
  assert.match(facebookImportErrorReason(denied), /permission denied.*42501/);
  await assert.rejects(facebookSupabaseOperation("facebook_imports.select", Promise.resolve({ error: denied, status: 403 })), (error: unknown) => {
    const details = facebookImportErrorDetails(error);
    assert.equal(details.httpStatus, 403);
    assert.deepEqual(details.supabaseError, denied);
    assert.match(String(details.stack), /FacebookImportError/);
    assert.equal(isFacebookAuthorizationError(error), false);
    return true;
  });
});

test("runner preserves the original failure when database failure recording also fails", async () => {
  globals[dbKey] = database(() => ({ data: null, error: denied, status: 403 }));
  await assert.rejects(runner.runFacebookImport(post), /facebook_imports.select.*HTTP 403.*42501/);
  assert.ok(errorLogs.some((args) => JSON.stringify(args).includes("record_failure")));
});

test("Graph failure retains HTTP status, full body, code, subcode and original cause despite denied DB writes", async (t) => {
  globals[dbKey] = database(() => ({ data: null, error: denied, status: 403 }));
  t.mock.method(globalThis, "fetch", async () => Response.json(failure, { status: 400 }));
  await assert.rejects(runner.importFacebookPostById(postId), (error: unknown) => {
    const details = facebookImportErrorDetails(error);
    assert.equal(details.httpStatus, 400);
    assert.deepEqual(details.graphResponseBody, failure);
    assert.equal(details.facebookErrorMessage, "Token expired");
    assert.equal(details.facebookErrorCode, 190);
    assert.equal(details.facebookErrorSubcode, 463);
    assert.equal(isFacebookAuthorizationError(error), true);
    return true;
  });
});

test("POST returns an actionable Supabase error and correlated server log", async () => {
  globals[dbKey] = database(() => ({ data: null, error: denied, status: 403 }));
  const response = await route.POST(new Request("http://localhost/api/facebook-import", { method: "POST", body: JSON.stringify({ action: "test", postId }) }));
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.match(body.error, /permission denied.*42501/);
  assert.ok(body.errorId);
  assert.ok(errorLogs.some((args) => JSON.stringify(args).includes(body.errorId)));
});

test("the supplied full ID and bare post suffix preserve numeric precision and produce drafts", async (t) => {
  const requested: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: URL, init: RequestInit) => {
    requested.push(String(input));
    assert.equal(input.searchParams.has("access_token"), false);
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer test-page-token");
    return Response.json(graphPost);
  });
  assert.equal((await graph.getFacebookPost(` ${postId} `)).postId, postId);
  assert.equal((await graph.getFacebookPost("122203917908429018")).postId, postId);
  assert.ok(requested.every((url) => url.includes(`/v24.0/${postId}?`)));
  const result = await runner.importFacebookPostById(postId);
  assert.equal(result.status, "succeeded");
  assert.equal(result.story.status, "draft");
});

test("POST success requires the sync settings update to succeed", async () => {
  const request = () => new Request("http://localhost/api/facebook-import", { method: "POST", body: JSON.stringify({ action: "test", postId }) });
  assert.equal((await route.POST(request())).status, 200);
  globals[dbKey] = database((query) => query.table === "facebook_sync_settings" ? { data: null, error: { ...denied, message: "permission denied for table facebook_sync_settings" }, status: 403 } : successfulDatabase(query));
  const response = await route.POST(request());
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /facebook_sync_settings.update.*HTTP 403/);
});

test("invalid IDs and malformed versions fail before issuing a Graph request", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch");
  await assert.rejects(graph.getFacebookPost("other-id"), /Post ID/);
  await assert.rejects(graph.getFacebookPost("123_456"), /粉專 ID/);
  process.env.FACEBOOK_GRAPH_API_VERSION = "24.0";
  await assert.rejects(graph.getFacebookPost(postId), /VERSION/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("non-JSON Graph failures keep the response body and status", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("upstream unavailable", { status: 502 }));
  await assert.rejects(graph.getFacebookPost(postId), (error: unknown) => {
    assert.equal(facebookImportErrorDetails(error).graphResponseBody, "upstream unavailable");
    assert.equal(facebookImportErrorDetails(error).httpStatus, 502);
    return true;
  });
});

test("pagination uses the same Graph diagnostics and rejects foreign origins", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (input: URL) => {
    assert.equal(input.searchParams.has("access_token"), false);
    calls++;
    return calls === 1 ? Response.json({ data: [graphPost], paging: { next: `https://graph.facebook.com/v24.0/${pageId}/posts?after=next&access_token=test-page-token` } }) : Response.json(failure, { status: 400 });
  });
  await assert.rejects(graph.listFacebookPosts("2026-10-01"), (error: unknown) => {
    assert.equal(facebookImportErrorDetails(error).facebookErrorSubcode, 463);
    return true;
  });
  t.mock.method(globalThis, "fetch", async () => Response.json({ data: [], paging: { next: "https://example.com/steal" } }));
  await assert.rejects(graph.listFacebookPosts("2026-10-01"), /pagination URL/);
});

test("logs redact configured secrets, URL tokens and bearer credentials", () => {
  const error = new FacebookImportError("Token test-page-token access_token=unconfigured", {
    graphResponseBody: { access_token: "unconfigured", message: "Bearer other-secret" },
  }, new Error("test-page-token"));
  const serialized = JSON.stringify(facebookImportErrorDetails(error));
  assert.doesNotMatch(serialized, /test-page-token|unconfigured|other-secret/);
  assert.match(serialized, /redacted/);
});

test("a draft upsert failure keeps its operation and SQL code even after failure bookkeeping fails", async () => {
  const sqlError = { code: "23502", message: "null value in column title violates not-null constraint", details: "failing row", hint: "check input" };
  globals[dbKey] = database((query) => {
    if (query.table === "stories" && query.operation === "upsert") return { data: null, error: sqlError, status: 400 };
    if (query.table === "facebook_imports" && query.operation === "upsert") return { data: null, error: denied, status: 403 };
    return successfulDatabase(query);
  });
  await assert.rejects(runner.runFacebookImport(post), (error: unknown) => {
    assert.equal(facebookImportErrorDetails(error).operation, "stories.upsert");
    assert.deepEqual(facebookImportErrorDetails(error).supabaseError, sqlError);
    assert.match(facebookImportErrorReason(error), /23502/);
    return true;
  });
});

test("storage errors retain their HTTP status and circular errors do not break diagnostics", async () => {
  await assert.rejects(facebookSupabaseOperation("travel-photos.upload", Promise.resolve({ error: { statusCode: "403", message: "Storage denied" } })), (error: unknown) => {
    assert.equal(facebookImportErrorDetails(error).httpStatus, 403);
    return true;
  });
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.match(facebookImportErrorReason(circular), /circular/);
  assert.doesNotThrow(() => facebookImportErrorDetails(new FacebookImportError("failed", { supabaseError: circular })));
});

test("v26 follows attachment/subattachment paging and ignores full_picture duplicates", async (t) => {
  process.env.FACEBOOK_GRAPH_API_VERSION = "v26.0";
  const photo = (id: string) => ({ type: "photo", target: { id }, media: { image: { src: `https://scontent.fbcdn.net/${id}.jpg` } } });
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: URL) => {
    requests.push(url.pathname);
    assert.equal(url.searchParams.has("access_token"), false);
    if (url.pathname.endsWith("/subattachments")) return Response.json({ data: [photo("2"), photo("3")] });
    if (url.pathname.endsWith("/attachments")) return Response.json({ data: [photo("4"), photo("1")] });
    assert.equal(url.pathname, `/v26.0/${postId}`);
    assert.match(url.searchParams.get("fields") || "", /subattachments\.limit\(100\)/);
    return Response.json({ ...graphPost, full_picture: photo("1").media.image.src, attachments: { data: [{ type: "album", subattachments: { data: [photo("1")], paging: { next: `https://graph.facebook.com/v26.0/${postId}/subattachments?access_token=test-page-token` } } }], paging: { next: `https://graph.facebook.com/v26.0/${postId}/attachments` } } });
  });
  const result = await graph.getFacebookPost(postId);
  assert.deepEqual(result.media.map((item) => item.sourceId), ["1", "2", "3", "4"]);
  assert.equal(requests.length, 3);
  const log = infoLogs.find((args) => args[0] === "Facebook attachment parsing")?.[1] as Record<string, unknown>;
  assert.equal(log.postId, postId);
  assert.equal(log.attachmentCount, 3);
  assert.equal(log.subattachmentCount, 3);
  assert.equal(log.imageUrlCount, 4);
});

test("nested attachment levels trigger deeper field projection before normalization", async (t) => {
  const photo = { type: "photo", target: { id: "deep" }, media: { image: { src: "https://scontent.fbcdn.net/deep.jpg" } } };
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: URL) => {
    calls++;
    const fields = url.searchParams.get("fields") || "";
    if (calls === 2) assert.equal((fields.match(/media\{image\{src\}\}/g) || []).length, 3);
    return Response.json({ ...graphPost, attachments: { data: [{ type: "album", subattachments: { data: [{ type: "album", subattachments: { data: [photo] } }] } }] } });
  });
  const result = await graph.getFacebookPost(postId);
  assert.equal(calls, 2);
  assert.deepEqual(result.media.map((item) => item.sourceId), ["deep"]);
});

test("a failed attachment page prevents all draft writes", async (t) => {
  let databaseCalls = 0;
  globals[dbKey] = database(() => { databaseCalls++; return { data: null, error: denied, status: 403 }; });
  t.mock.method(globalThis, "fetch", async (url: URL) => url.pathname.endsWith("/attachments")
    ? Response.json(failure, { status: 400 })
    : Response.json({ ...graphPost, attachments: { data: [], paging: { next: `https://graph.facebook.com/v24.0/${postId}/attachments` } } }));
  await assert.rejects(runner.importFacebookPostById(postId), /Token expired/);
  assert.equal(databaseCalls, 1, "only best-effort failure recording reads the database; no draft/photo is changed");
});

test("four-photo imports write all Storage objects/media rows; a failed middle photo retries without duplicates", async (t) => {
  type Row = { id: string; story_id: string; storage_path: string; sort_order: number; kind: string };
  const mediaRows: Row[] = [];
  const storagePaths = new Set<string>();
  let uploadCount = 0;
  let importRow: Record<string, unknown> | null = null;
  const story = successfulDatabase({ table: "stories", operation: "upsert", filters: {} }).data as Record<string, unknown>;
  const db = database((query) => {
    if (query.table === "facebook_imports") {
      if (query.operation === "upsert") importRow = { ...importRow, ...query.input as object, id: "import-1" };
      return ok(importRow);
    }
    if (query.table === "stories") {
      if (query.operation === "select" && !query.filters.id) return ok(null);
      if (query.input) Object.assign(story, query.input);
      return ok(story);
    }
    if (query.table === "story_media") {
      if (query.operation === "insert") {
        mediaRows.push({ ...query.input as Row, id: `media-${mediaRows.length + 1}` });
        return ok(null);
      }
      if (query.operation === "update") {
        const row = mediaRows.find((row) => row.id === query.filters.id);
        Object.assign(row!, query.input);
        return ok(row);
      }
      let rows = [...mediaRows].sort((a, b) => a.sort_order - b.sort_order);
      if (query.filters.storage_path && !String(query.filters.storage_path).includes("%")) rows = rows.filter((row) => row.storage_path === query.filters.storage_path);
      if (query.columns === "sort_order") return ok(rows.at(-1) || null);
      return ok(query.single ? rows[0] || null : rows);
    }
    return successfulDatabase(query);
  });
  globals[dbKey] = { ...db, storage: { from(bucket: string) {
    assert.equal(bucket, "travel-photos");
    return {
      async upload(path: string, _body: ArrayBuffer, options: { upsert: boolean }) {
        assert.equal(options.upsert, true);
        storagePaths.add(path);
        uploadCount++;
        return { data: { path }, error: null };
      },
      async remove() { throw new Error("Unexpected cleanup"); },
      async move() { throw new Error("Unexpected removal of existing data"); },
    };
  } } };
  let failSecond = true;
  t.mock.method(globalThis, "fetch", async (url: URL | string) => {
    const location = new URL(url);
    if (location.hostname !== "graph.facebook.com") return new Response("photo bytes", { status: failSecond && location.pathname === "/2.jpg" ? 503 : 200, headers: { "content-type": "image/jpeg" } });
    return Response.json({ ...graphPost, attachments: { data: [{ type: "album", subattachments: { data: ["1", "2", "3", "4"].map((id) => ({ type: "photo", target: { id }, media: { image: { src: `https://scontent.fbcdn.net/${id}.jpg` } } })) } }] } });
  });
  const first = await runner.importFacebookPostById(postId);
  assert.equal(first.status, "needs_attention");
  assert.equal(mediaRows.length, 3);
  failSecond = false;
  const repaired = await runner.retryFacebookImport(postId);
  assert.equal(repaired.status, "succeeded");
  assert.equal(repaired.story.id, first.story.id);
  assert.equal(mediaRows.length, 4);
  assert.equal(storagePaths.size, 4);
  assert.deepEqual([...mediaRows].sort((a, b) => a.sort_order - b.sort_order).map((row) => row.storage_path.split("/").at(-1)), ["1.jpg", "2.jpg", "3.jpg", "4.jpg"]);
  assert.equal(story.cover_path, "travel-photos/facebook-live/story-1/1.jpg");
  await runner.retryFacebookImport(postId);
  assert.equal(uploadCount, 4);
  assert.equal(mediaRows.length, 4);
  const written = infoLogs.filter((args) => args[0] === "Facebook draft images").at(-1)?.[1] as Record<string, unknown>;
  assert.equal(written.writtenImageCount, 4);
});
