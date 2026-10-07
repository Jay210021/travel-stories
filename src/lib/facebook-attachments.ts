import { createHash } from "node:crypto";
import type { FacebookMedia } from "./facebook-import.ts";

export type FacebookAttachmentConnection = {
  data?: FacebookAttachment[];
  paging?: { next?: string };
};
export type FacebookAttachment = {
  type?: string;
  media_type?: string;
  target?: { id?: string; url?: string };
  media?: { image?: { src?: string } };
  subattachments?: FacebookAttachmentConnection;
};

// At the boundary, request subattachments as well so a deeper tree is visible.
// The Graph adapter repeats the query with deeper field expansion when needed.
export function facebookAttachmentFields(depth = 1): string {
  const own = "type,media_type,media{image{src}},target{id,url}";
  return depth > 0 ? `${own},subattachments.limit(100){${facebookAttachmentFields(depth - 1)}}`
    : `${own},subattachments.limit(100)`;
}

export function facebookPostFields(depth = 1): string {
  return `id,message,created_time,updated_time,permalink_url,from{id},attachments.limit(100){${facebookAttachmentFields(depth)}}`;
}

export async function completeFacebookAttachments(
  connection: FacebookAttachmentConnection | undefined,
  loadPage: (url: string, fields: string) => Promise<FacebookAttachmentConnection>,
  projectedDepth = 1,
  nodeDepth = 0,
): Promise<FacebookAttachmentConnection | undefined> {
  if (!connection) return undefined;
  const items: FacebookAttachment[] = [];
  let page = connection;
  const visited = new Set<string>();
  for (;;) {
    if (!Array.isArray(page.data)) throw new Error("Facebook attachment connection 缺少 data 陣列，停止匯入以避免遺失既有圖片。");
    items.push(...page.data);
    const next = page.paging?.next;
    if (!next) break;
    if (visited.has(next)) throw new Error("Facebook attachment pagination 重複，無法確認已取得完整圖片。");
    visited.add(next);
    page = await loadPage(next, facebookAttachmentFields(Math.max(0, projectedDepth - nodeDepth)));
  }
  const data: FacebookAttachment[] = [];
  for (const item of items) {
    data.push({ ...item, subattachments: await completeFacebookAttachments(item.subattachments, loadPage, projectedDepth, nodeDepth + 1) });
  }
  return { data };
}

export function facebookAttachmentDepth(items: FacebookAttachment[] = []): number {
  return items.reduce((maximum, item) => item.subattachments?.data?.length
    ? Math.max(maximum, 1 + facebookAttachmentDepth(item.subattachments.data)) : maximum, 0);
}

function imageIdentity(value: string): string {
  const url = new URL(value);
  url.hash = "";
  // Facebook CDN signatures and resizing parameters rotate for the same photo.
  // Keep other hosts' query strings: /image?id=1 and /image?id=2 are distinct.
  if (/(^|\.)(fbcdn\.net|fbsbx\.com)$/i.test(url.hostname)) return `facebook-cdn:${url.pathname}`;
  url.searchParams.sort();
  return url.toString();
}

function photoId(item: FacebookAttachment, identity: string): string {
  if (item.target?.id) return item.target.id;
  try {
    const target = new URL(item.target?.url || "");
    if (/(^|\.)facebook\.com$/i.test(target.hostname)) {
      const fbid = target.searchParams.get("fbid");
      if (fbid && /^\d+$/.test(fbid)) return fbid;
    }
  } catch { /* A target URL is optional and is never downloaded as an image. */ }
  return `photo-url-${createHash("sha256").update(identity).digest("hex").slice(0, 32)}`;
}

export function parseFacebookAttachments(items: FacebookAttachment[] = []) {
  const media: FacebookMedia[] = [];
  const ids = new Set<string>();
  const urls = new Set<string>();
  function countSubattachments(nodes: FacebookAttachment[]): number {
    return nodes.reduce((count, item) => {
      const children = item.subattachments?.data || [];
      return count + children.length + countSubattachments(children);
    }, 0);
  }
  const subattachmentCount = countSubattachments(items);
  let excludedAttachmentCount = 0;
  function visit(nodes: FacebookAttachment[], path: string) {
    for (const [index, item] of nodes.entries()) {
      const type = (item.type || "").toLowerCase();
      const mediaType = (item.media_type || "").toLowerCase();
      const itemPath = `${path}-${index}`;
      const children = item.subattachments?.data || [];
      // A link/profile/icon preview is not a gallery, even if it has image data.
      const excluded = /(?:link|share|profile|avatar|icon)/.test(`${type} ${mediaType}`);
      const video = /video|reel|live/.test(type) || /video/.test(mediaType);
      if (children.length && !excluded && !video) { visit(children, itemPath); continue; }
      if (video || excluded) {
        excludedAttachmentCount++;
        media.push({ sourceId: item.target?.id || `attachment${itemPath}`, type: video ? "video" : "shared" });
        continue;
      }
      const container = ["album", "carousel", "multi_photo", "photo_multi", "photos"].includes(type);
      const photo = !container && (["photo", "photo_inline", "image"].includes(type) || mediaType === "photo" || mediaType === "image");
      if (!photo || !item.media?.image?.src) {
        excludedAttachmentCount++;
        if (photo) media.push({ sourceId: item.target?.id || `attachment${itemPath}`, type: "photo" });
        else if (container) media.push({ sourceId: item.target?.id || `attachment${itemPath}`, type: "shared" });
        continue;
      }
      const url = item.media.image.src;
      let identity: string;
      try {
        const parsed = new URL(url);
        if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Invalid image protocol");
        identity = imageIdentity(url);
      } catch { throw new Error(`Facebook 圖片 ${itemPath} 的 media.image.src 不是有效 HTTP 圖片網址。`); }
      const sourceId = photoId(item, identity);
      const duplicate = ids.has(sourceId) || urls.has(identity);
      ids.add(sourceId);
      urls.add(identity);
      if (duplicate) continue;
      media.push({ sourceId, type: "photo", url });
    }
  }
  visit(items, "");
  return { media, attachmentCount: items.length, subattachmentCount, imageUrlCount: media.filter((item) => item.type === "photo" && item.url).length, excludedAttachmentCount };
}

type OrderedMedia = { id: string; storage_path: string; sort_order: number; kind: string };

// Reorder only the slots belonging to Facebook photos; preserve manual media.
export function orderFacebookStoryMedia<T extends OrderedMedia>(rows: T[], storyId: string, sourceIds: string[]): T[] {
  const prefix = `travel-photos/facebook-live/${storyId}/`;
  const byPath = new Map(rows.map((row) => [row.storage_path, row]));
  const wanted = sourceIds.map((id) => byPath.get(`${prefix}${id.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 120)}.jpg`)).filter((row): row is T => Boolean(row));
  const selected = new Set(wanted.map((row) => row.id));
  let index = 0;
  return rows.map((row) => selected.has(row.id) ? wanted[index++] : row);
}
