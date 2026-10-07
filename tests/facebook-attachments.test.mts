import assert from "node:assert/strict";
import test from "node:test";
import {
  completeFacebookAttachments, facebookPostFields, orderFacebookStoryMedia,
  parseFacebookAttachments, type FacebookAttachment,
} from "../src/lib/facebook-attachments.ts";

const photo = (id: string, url = `https://scontent.fbcdn.net/${id}.jpg?sig=old`): FacebookAttachment => ({
  type: "photo", media_type: "photo", target: { id, url: `https://www.facebook.com/photo.php?fbid=${id}` }, media: { image: { src: url } },
});
const album = (data: FacebookAttachment[]): FacebookAttachment => ({ type: "album", media: { image: { src: "https://scontent.fbcdn.net/preview.jpg" } }, subattachments: { data } });

test("single photos and albums retain all photos in Facebook order without adding the parent preview", () => {
  assert.deepEqual(parseFacebookAttachments([photo("1")]).media.map((item) => item.sourceId), ["1"]);
  const result = parseFacebookAttachments([album([photo("1"), photo("2"), photo("3"), photo("4")])]);
  assert.deepEqual(result.media.map((item) => item.sourceId), ["1", "2", "3", "4"]);
  assert.equal(result.attachmentCount, 1);
  assert.equal(result.subattachmentCount, 4);
  assert.equal(result.imageUrlCount, 4);
});

test("nested galleries expand depth first and anonymous photos cannot overwrite each other", () => {
  const noId = (id: string): FacebookAttachment => ({ ...photo(id), target: undefined });
  const result = parseFacebookAttachments([album([album([noId("a"), noId("b")]), { type: "carousel", subattachments: { data: [noId("c"), photo("4")] } }])]);
  assert.deepEqual(result.media.map((item) => item.url), ["a", "b", "c", "4"].map((id) => `https://scontent.fbcdn.net/${id}.jpg?sig=old`));
  assert.equal(new Set(result.media.map((item) => item.sourceId)).size, 4);
  assert.equal(result.subattachmentCount, 6);
  const refreshed = parseFacebookAttachments([{ ...noId("a"), media: { image: { src: "https://scontent.fbcdn.net/a.jpg?sig=new&stp=resized" } } }]);
  assert.equal(refreshed.media[0].sourceId, result.media[0].sourceId);
});

test("photos deduplicate by target ID and CDN URL while query-addressed external images remain distinct", () => {
  const items = [photo("1"), photo("1", "https://scontent.fbcdn.net/1-large.jpg"), photo("alias", "https://scontent.fbcdn.net/1.jpg?sig=new"), photo("alias", "https://scontent.fbcdn.net/alias.jpg"), photo("2", "https://example.com/image?id=2"), photo("3", "https://example.com/image?id=3")];
  const result = parseFacebookAttachments(items);
  assert.deepEqual(result.media.map((item) => item.sourceId), ["1", "2", "3"]);
  assert.equal(result.imageUrlCount, 3);
});

test("link, video, profile and icon previews are excluded even when image data or photo children are present", () => {
  const items: FacebookAttachment[] = ["share", "link", "video_inline", "profile_photo", "icon"].map((type) => ({ ...photo(type), type, subattachments: { data: [photo(`${type}-preview`)] } }));
  const result = parseFacebookAttachments([...items, photo("real")]);
  assert.deepEqual(result.media.filter((item) => item.type === "photo").map((item) => item.sourceId), ["real"]);
  assert.ok(result.media.filter((item) => item.type !== "photo").every((item) => !item.url));
  assert.equal(result.imageUrlCount, 1);
});

test("a photo target permalink is not downloaded in place of a missing image source", () => {
  const item = photo("1");
  delete item.media;
  assert.equal(parseFacebookAttachments([item]).media[0].url, undefined);
});

test("attachment and nested subattachment paging finish before parsing and keep page order", async () => {
  const root = { data: [{ ...album([photo("1")]), subattachments: { data: [photo("1")], paging: { next: "children-2" } } }], paging: { next: "root-2" } };
  const completed = await completeFacebookAttachments(root, async (next, fields) => {
    assert.match(fields, /media\{image\{src\}\}/);
    if (next === "root-2") return { data: [photo("4")] };
    if (next === "children-2") return { data: [album([photo("2"), photo("3")])] };
    throw new Error("Unexpected page");
  });
  assert.deepEqual(parseFacebookAttachments(completed?.data).media.map((item) => item.sourceId), ["1", "2", "3", "4"]);
  assert.equal(root.data[0].subattachments.data.length, 1, "the original API payload is not mutated");
});

test("incomplete, failed or cyclic pagination throws instead of returning partial images", async () => {
  await assert.rejects(completeFacebookAttachments({ data: [photo("1")], paging: { next: "failed" } }, async () => { throw new Error("Graph 403"); }), /403/);
  await assert.rejects(completeFacebookAttachments({ data: [], paging: { next: "cycle" } }, async () => ({ data: [], paging: { next: "cycle" } })), /pagination/);
  await assert.rejects(completeFacebookAttachments({}, async () => ({ data: [] })), /data/);
});

test("the same field projection works independently of v24/v26 and expands deeper on demand", () => {
  const fields = facebookPostFields();
  assert.match(fields, /attachments\.limit\(100\)\{type,media_type,media\{image\{src\}\},target\{id,url\},subattachments\.limit\(100\)\{/);
  assert.doesNotMatch(fields, /full_picture|icon|picture,/);
  assert.equal((facebookPostFields(4).match(/media\{image\{src\}\}/g) || []).length, 5);
});

test("retries restore Facebook photo order and leave manual media in their existing slots", () => {
  const row = (id: string, sort_order: number, storage_path = `travel-photos/facebook-live/story-1/${id}.jpg`) => ({ id, sort_order, storage_path, kind: "photo" });
  const rows = [row("1", 0), row("manual", 1, "travel-photos/manual.jpg"), row("3", 2), row("2", 3)];
  assert.deepEqual(orderFacebookStoryMedia(rows, "story-1", ["1", "2", "3"]).map((item) => item.id), ["1", "manual", "2", "3"]);
  assert.deepEqual(orderFacebookStoryMedia(rows, "story-1", ["1", "missing", "2", "3"]).map((item) => item.id), ["1", "manual", "2", "3"]);
});
