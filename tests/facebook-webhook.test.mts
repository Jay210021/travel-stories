import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { extractFacebookChanges, isFacebookWebhookTooLarge, MAX_FACEBOOK_WEBHOOK_BYTES, verifyFacebookSignature } from "../src/lib/facebook-webhook.ts";

test("accepts only a matching Meta SHA-256 webhook signature", () => {
  const body = JSON.stringify({ object: "page", entry: [] });
  const signature = `sha256=${createHmac("sha256", "app-secret").update(body).digest("hex")}`;
  assert.equal(verifyFacebookSignature(body, signature, "app-secret"), true);
  assert.equal(verifyFacebookSignature(body, "sha256=wrong", "app-secret"), false);
  assert.equal(verifyFacebookSignature(body, null, "app-secret"), false);
});

test("rejects invalid or oversized declared webhook bodies", () => {
  assert.equal(isFacebookWebhookTooLarge(null), false);
  assert.equal(isFacebookWebhookTooLarge(String(MAX_FACEBOOK_WEBHOOK_BYTES)), false);
  assert.equal(isFacebookWebhookTooLarge(String(MAX_FACEBOOK_WEBHOOK_BYTES + 1)), true);
  assert.equal(isFacebookWebhookTooLarge("invalid"), true);
  assert.equal(isFacebookWebhookTooLarge("-1"), true);
});

test("extracts supported Page feed changes without retaining the full webhook payload", () => {
  const changes = extractFacebookChanges({
    object: "page",
    entry: [{ id: "page-1", time: 123, changes: [
      { field: "feed", value: { item: "post", verb: "add", post_id: "page-1_42" } },
      { field: "feed", value: { item: "comment", verb: "add", post_id: "page-1_42" } },
      { field: "feed", value: { item: "post", verb: "remove", post_id: "page-1_43" } },
    ] }],
  });
  assert.deepEqual(changes, [
    { pageId: "page-1", postId: "page-1_42", kind: "upsert", receivedAt: 123 },
    { pageId: "page-1", postId: "page-1_43", kind: "remove", receivedAt: 123 },
  ]);
});
