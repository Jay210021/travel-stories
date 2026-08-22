import { after } from "next/server";
import { enqueueFacebookChange, processFacebookEvent } from "@/lib/facebook-import-runner";
import { extractFacebookChanges, isFacebookWebhookTooLarge, MAX_FACEBOOK_WEBHOOK_BYTES, verifyFacebookSignature } from "@/lib/facebook-webhook";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN && challenge) return new Response(challenge, { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (isFacebookWebhookTooLarge(request.headers.get("content-length"))) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }
  if (!appSecret) return Response.json({ error: "Facebook Webhook 尚未設定" }, { status: 503 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_FACEBOOK_WEBHOOK_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }
  if (!verifyFacebookSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) return Response.json({ error: "Invalid signature" }, { status: 401 });
  const payload = (() => { try { return JSON.parse(rawBody) as unknown; } catch { return null; } })();
  if (!payload) return Response.json({ error: "Invalid payload" }, { status: 400 });
  const configuredPage = process.env.FACEBOOK_PAGE_ID;
  const changes = extractFacebookChanges(payload).filter((change) => !configuredPage || change.pageId === configuredPage);
  const eventIds = await Promise.all(changes.map((change) => enqueueFacebookChange(change.pageId, change.postId, change.kind, change.receivedAt * 1000)));
  after(async () => { await Promise.all(eventIds.map(processFacebookEvent)); });
  return Response.json({ received: eventIds.length });
}
