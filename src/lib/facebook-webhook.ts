import { createHmac, timingSafeEqual } from "node:crypto";

export type FacebookWebhookChange = { pageId: string; postId: string; kind: "upsert" | "remove"; receivedAt: number };
export const MAX_FACEBOOK_WEBHOOK_BYTES = 1024 * 1024;

export function isFacebookWebhookTooLarge(contentLength: string | null) {
  if (contentLength === null) return false;
  const bytes = Number(contentLength);
  return !Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_FACEBOOK_WEBHOOK_BYTES;
}

export function verifyFacebookSignature(rawBody: string, signature: string | null, appSecret: string) {
  if (!signature?.startsWith("sha256=") || !appSecret) return false;
  const received = signature.slice("sha256=".length);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8"));
}

export function extractFacebookChanges(payload: unknown): FacebookWebhookChange[] {
  if (!payload || typeof payload !== "object" || (payload as { object?: unknown }).object !== "page") return [];
  const entries = Array.isArray((payload as { entry?: unknown }).entry) ? (payload as { entry: unknown[] }).entry : [];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const pageId = (entry as { id?: unknown }).id;
    const receivedAt = (entry as { time?: unknown }).time;
    const changes = (entry as { changes?: unknown }).changes;
    if (typeof pageId !== "string" || typeof receivedAt !== "number" || !Array.isArray(changes)) return [];
    return changes.flatMap((change): FacebookWebhookChange[] => {
      if (!change || typeof change !== "object" || (change as { field?: unknown }).field !== "feed") return [];
      const value = (change as { value?: unknown }).value;
      if (!value || typeof value !== "object") return [];
      const item = (value as { item?: unknown }).item;
      const verb = (value as { verb?: unknown }).verb;
      const postId = (value as { post_id?: unknown }).post_id;
      if (item !== "post" || typeof postId !== "string" || !new Set(["add", "edited", "remove"]).has(String(verb))) return [];
      return [{ pageId, postId, kind: verb === "remove" ? "remove" : "upsert", receivedAt }];
    });
  });
}
