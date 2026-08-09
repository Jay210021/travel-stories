import fs from "node:fs/promises";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first.");

const root = path.resolve(process.cwd(), "..", "facebook-export");
const drafts = JSON.parse(await fs.readFile("docs/facebook-drafts.json", "utf8")).drafts;
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const argument = (name, fallback) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] ?? fallback : fallback; };
const only = argument("--only", "all");
const sourceMedia = argument("--source-media", "");
const sourceFile = argument("--source-file", "");
if (!new Set(["all", "photos", "videos"]).has(only)) throw new Error("Use --only photos, --only videos, or omit it for all media.");
const offset = Number(argument("--offset", "0"));
const limit = Number(argument("--limit", "50"));
const isVideo = (filePath) => /\.(mp4|mov|webm)$/i.test(filePath);
const descriptor = (filePath) => {
  const video = isVideo(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const contentType = video ? ({ ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm" }[extension] ?? "application/octet-stream") : ({ ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" }[extension] ?? "image/jpeg");
  return { kind: video ? "video" : "photo", bucket: video ? "travel-videos" : "travel-photos", contentType };
};

const storiesResponse = await fetch(`${url}/rest/v1/stories?select=id,source_id`, { headers });
if (!storiesResponse.ok) throw new Error(`Could not load stories: ${storiesResponse.status}`);
const stories = await storiesResponse.json();
const storyIds = new Map(stories.map((story) => [story.source_id, story.id]));
const tasks = drafts.flatMap((draft) => draft.media.map((media) => ({ draft, media, descriptor: descriptor(media.path) }))).filter((task) => (only === "all" || (only === "videos" ? task.descriptor.kind === "video" : task.descriptor.kind === "photo")) && (!sourceMedia || task.media.path === sourceMedia));
const batch = tasks.slice(offset, offset + limit);
const concurrency = Number(argument("--concurrency", only === "videos" ? "1" : "4"));
let done = 0; let skipped = 0; let missing = 0; let failed = 0;

async function processOne({ draft, media, descriptor: mediaType }) {
  const storyId = storyIds.get(draft.draftId);
  if (!storyId) { missing++; return; }
  const source = sourceFile ? path.resolve(sourceFile) : path.resolve(root, media.path);
  if ((!sourceFile && !source.startsWith(`${root}${path.sep}`)) || !await fs.access(source).then(() => true).catch(() => false)) { missing++; return; }
  const relative = `facebook/${draft.draftId}/${path.basename(media.path)}`;
  const storagePath = `${mediaType.bucket}/${relative}`;
  const duplicateResponse = await fetch(`${url}/rest/v1/story_media?select=id&storage_path=eq.${encodeURIComponent(storagePath)}`, { headers });
  if (!duplicateResponse.ok) throw new Error(`Could not check duplicate ${media.path}: ${duplicateResponse.status}`);
  if ((await duplicateResponse.json()).length) { skipped++; return; }
  const body = await fs.readFile(source);
  const upload = await fetch(`${url}/storage/v1/object/${mediaType.bucket}/${encodeURIComponent(relative).replaceAll("%2F", "/")}`, { method: "POST", headers: { ...headers, "Content-Type": mediaType.contentType, "x-upsert": "true" }, body });
  if (!upload.ok) { failed++; console.error(`Upload skipped ${media.path}: ${upload.status} ${await upload.text()}`); return; }
  const insert = await fetch(`${url}/rest/v1/story_media`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ story_id: storyId, kind: mediaType.kind, storage_path: storagePath, sort_order: media.order, caption: media.caption || "", alt_text: media.alt || path.basename(media.path) }) });
  if (!insert.ok) { failed++; await fetch(`${url}/storage/v1/object/${mediaType.bucket}/${encodeURIComponent(relative).replaceAll("%2F", "/")}`, { method: "DELETE", headers }); console.error(`Media link failed ${media.path}: ${insert.status} ${await insert.text()}`); return; }
  done++; console.log(`Imported ${mediaType.kind}: ${done}/${batch.length} · ${media.path}`);
}

let cursor = 0;
async function worker() { while (cursor < batch.length) await processOne(batch[cursor++]); }
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
console.log(`Facebook ${only} media import complete: ${done} imported, ${skipped} already linked, ${missing} missing, ${failed} failed; offset=${offset}, limit=${limit}.`);
