import "server-only";
import type { FacebookMedia, FacebookPost } from "./facebook-import";

type Attachment = {
  type?: string;
  target?: { id?: string; url?: string };
  media?: { image?: { src?: string } };
  subattachments?: { data?: Attachment[] };
};
type GraphPost = {
  id: string; message?: string; created_time: string; updated_time?: string; permalink_url?: string;
  from?: { id?: string };
  attachments?: { data?: Attachment[] };
};

function config() {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const version = process.env.FACEBOOK_GRAPH_API_VERSION || "v24.0";
  if (!pageId || !accessToken) throw new Error("尚未設定 FACEBOOK_PAGE_ID 與 FACEBOOK_PAGE_ACCESS_TOKEN。");
  return { pageId, accessToken, version };
}

async function graph<T>(path: string, params: Record<string, string> = {}) {
  const { accessToken, version } = config();
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data as { error?: { message?: string; code?: number } };
    throw new Error(`Meta Graph API ${error.error?.code ?? response.status}：${error.error?.message ?? "讀取失敗"}`);
  }
  return data as T;
}

async function nextGraphPage<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data as { error?: { message?: string; code?: number } };
    throw new Error(`Meta Graph API ${error.error?.code ?? response.status}：${error.error?.message ?? "讀取失敗"}`);
  }
  return data as T;
}

function mediaType(type = ""): FacebookMedia["type"] {
  if (type.includes("photo")) return "photo";
  if (type.includes("video")) return "video";
  if (type.includes("share")) return "shared";
  return "shared";
}

function flattenAttachments(items: Attachment[] = []): FacebookMedia[] {
  return items.flatMap((item, index) => item.subattachments?.data?.length
    ? flattenAttachments(item.subattachments.data)
    : [{
        sourceId: item.target?.id || `attachment-${index}`,
        type: mediaType(item.type),
        url: item.media?.image?.src || item.target?.url,
      }]);
}

function normalize(post: GraphPost, pageId: string): FacebookPost {
  return {
    pageId, postId: post.id, message: post.message || "", createdTime: post.created_time,
    updatedTime: post.updated_time || post.created_time,
    permalinkUrl: post.permalink_url || `https://www.facebook.com/${post.id}`,
    media: flattenAttachments(post.attachments?.data),
  };
}

const fields = "id,message,created_time,updated_time,permalink_url,from{id},attachments{type,target,media,subattachments{type,target,media}}";

export async function getFacebookPage() {
  const { pageId } = config();
  return graph<{ id: string; name: string }>(pageId, { fields: "id,name" });
}

export async function getFacebookPost(postId: string) {
  const { pageId } = config();
  const post = await graph<GraphPost>(postId, { fields });
  if (post.from?.id && post.from.id !== pageId) throw new Error("這篇貼文不是由已設定的 Facebook 粉絲專頁發布。");
  return normalize(post, pageId);
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
  return posts.filter((post) => !post.from?.id || post.from.id === pageId).map((post) => normalize(post, pageId));
}
