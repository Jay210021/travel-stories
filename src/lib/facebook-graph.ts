import "server-only";
import type { FacebookPost } from "./facebook-import";
import { FacebookImportError, facebookImportErrorReason } from "./facebook-import-error";
import { completeFacebookAttachments, facebookAttachmentDepth, facebookPostFields, parseFacebookAttachments, type FacebookAttachmentConnection } from "./facebook-attachments";

type GraphPost = {
  id: string; message?: string; created_time: string; updated_time?: string; permalink_url?: string;
  from?: { id?: string };
  attachments?: FacebookAttachmentConnection;
};

function config() {
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
  const version = process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || "v24.0";
  const missing = [!pageId && "FACEBOOK_PAGE_ID", !accessToken && "FACEBOOK_PAGE_ACCESS_TOKEN"].filter(Boolean);
  if (missing.length) throw new Error(`尚未設定 ${missing.join("、")}。`);
  if (!/^\d+$/.test(pageId!)) throw new Error("FACEBOOK_PAGE_ID 必須為數字粉專 ID。");
  if (!/^v\d+\.\d+$/.test(version)) throw new Error("FACEBOOK_GRAPH_API_VERSION 格式必須為 v24.0 這類版本字串。");
  return { pageId: pageId!, accessToken: accessToken!, version };
}

async function requestGraph<T>(url: URL): Promise<T> {
  const { accessToken, version } = config();
  if (url.origin !== "https://graph.facebook.com") throw new Error("Graph API pagination URL 必須來自 graph.facebook.com。");
  url.searchParams.delete("access_token");
  const context = { provider: "facebook" as const, operation: `GET ${url.pathname}`, graphApiVersion: version };
  let response: Response;
  let body: string;
  try {
    response = await fetch(url, { cache: "no-store", headers: { Authorization: `Bearer ${accessToken}` } });
    body = await response.text();
  } catch (error) {
    throw new FacebookImportError(`Meta Graph API request failed: ${facebookImportErrorReason(error)}`, context, error);
  }
  let data: { error?: { message?: string; code?: number; error_subcode?: number } };
  try { data = JSON.parse(body); }
  catch (error) {
    throw new FacebookImportError(`Meta Graph API 回傳非 JSON 資料 (HTTP ${response.status})`, { ...context, httpStatus: response.status, graphResponseBody: body }, error);
  }
  if (!response.ok || data?.error || !data || typeof data !== "object") {
    const facebookError = data?.error;
    throw new FacebookImportError(`Meta Graph API ${facebookError?.code ?? response.status} (HTTP ${response.status})：${facebookError?.message ?? "讀取失敗"}`, {
      ...context, httpStatus: response.status, graphResponseBody: data,
      facebookErrorMessage: facebookError?.message,
      facebookErrorCode: facebookError?.code, facebookErrorSubcode: facebookError?.error_subcode,
    });
  }
  return data as T;
}

async function graph<T>(path: string, params: Record<string, string> = {}) {
  const { version } = config();
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return requestGraph<T>(url);
}

async function nextGraphPage<T>(url: string) {
  return requestGraph<T>(new URL(url));
}

async function completePostAttachments(initial: GraphPost): Promise<GraphPost> {
  let post = initial;
  let projectedDepth = 1;
  for (;;) {
    const attachments = await completeFacebookAttachments(post.attachments, async (next, fields) => {
      const url = new URL(next);
      url.searchParams.set("fields", fields);
      return requestGraph<FacebookAttachmentConnection>(url);
    }, projectedDepth);
    const actualDepth = facebookAttachmentDepth(attachments?.data);
    if (actualDepth <= projectedDepth) return { ...post, attachments };
    // No fixed nesting cutoff: explicitly fetch fields at every observed level.
    projectedDepth = actualDepth;
    post = await graph<GraphPost>(post.id, { fields: facebookPostFields(projectedDepth) });
  }
}

function normalize(post: GraphPost, pageId: string): FacebookPost {
  if (typeof post.id !== "string" || !post.created_time || !Number.isFinite(Date.parse(post.created_time))) {
    throw new FacebookImportError("Graph API 貼文缺少有效 id 或 created_time。", { provider: "facebook", operation: "normalize_post", graphResponseBody: post });
  }
  const parsed = parseFacebookAttachments(post.attachments?.data);
  console.info("Facebook attachment parsing", {
    postId: post.id, graphApiVersion: config().version,
    attachmentCount: parsed.attachmentCount, subattachmentCount: parsed.subattachmentCount,
    imageUrlCount: parsed.imageUrlCount, excludedAttachmentCount: parsed.excludedAttachmentCount,
  });
  return {
    pageId, postId: post.id, message: post.message || "", createdTime: post.created_time,
    updatedTime: post.updated_time || post.created_time,
    permalinkUrl: post.permalink_url || `https://www.facebook.com/${post.id}`,
    media: parsed.media,
  };
}

const fields = facebookPostFields();

export async function getFacebookPage() {
  const { pageId } = config();
  return graph<{ id: string; name: string }>(pageId, { fields: "id,name" });
}

export async function getFacebookPost(postId: string) {
  const { pageId } = config();
  const input = postId.trim();
  const normalizedId = /^\d+$/.test(input) ? `${pageId}_${input}` : input;
  if (!/^\d+_\d+$/.test(normalizedId)) throw new Error("Facebook Post ID 必須為 PAGE_ID_POST_ID 或數字 Post ID。");
  if (normalizedId.split("_")[0] !== pageId) throw new Error("Facebook Post ID 的粉專 ID 與 FACEBOOK_PAGE_ID 不符。");
  const post = await graph<GraphPost>(normalizedId, { fields });
  if (post.from?.id && post.from.id !== pageId) throw new Error("這篇貼文不是由已設定的 Facebook 粉絲專頁發布。");
  return normalize(await completePostAttachments(post), pageId);
}

export async function listFacebookPosts(since: string) {
  const { pageId } = config();
  type Page = { data?: GraphPost[]; paging?: { next?: string } };
  let page = await graph<Page>(`${pageId}/posts`, { fields, since, limit: "100" });
  const posts = [...(page.data || [])];
  const visited = new Set<string>();
  while (page.paging?.next && !visited.has(page.paging.next)) {
    visited.add(page.paging.next);
    page = await nextGraphPage<Page>(page.paging.next);
    posts.push(...(page.data || []));
  }
  const normalized: FacebookPost[] = [];
  for (const post of posts.filter((post) => !post.from?.id || post.from.id === pageId)) {
    normalized.push(normalize(await completePostAttachments(post), pageId));
  }
  return normalized;
}
