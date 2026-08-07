import fs from "node:fs/promises";
import path from "node:path";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first.");
const root = path.resolve(process.cwd(), "..", "facebook-export");
const drafts = JSON.parse(await fs.readFile("docs/facebook-drafts.json", "utf8")).drafts;
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const stories = await (await fetch(`${url}/rest/v1/stories?select=id,source_id`, { headers })).json();
const storyIds = new Map(stories.map((story) => [story.source_id, story.id]));
const tasks = [];
for (const draft of drafts) for (const media of draft.media) if (!/\.(mp4|mov|webm)$/i.test(media.path)) tasks.push({ draft, media });
const offset = Number(process.argv[process.argv.indexOf("--offset") + 1] || 0);
const limit = Number(process.argv[process.argv.indexOf("--limit") + 1] || 50);
const batch = tasks.slice(offset, offset + limit);
let done = 0; let skipped = 0;
async function processOne({ draft, media }) {
  const storyId = storyIds.get(draft.draftId); if (!storyId) return;
  const source = path.resolve(root, media.path); const exists = await fs.access(source).then(() => true).catch(() => false); if (!exists) return;
  const relative = `facebook/${draft.draftId}/${path.basename(media.path)}`; const storagePath = `travel-photos/${relative}`;
  const duplicate = await (await fetch(`${url}/rest/v1/story_media?select=id&storage_path=eq.${encodeURIComponent(storagePath)}`, { headers })).json();
  if (duplicate.length) { skipped++; return; }
  const body = await fs.readFile(source);
  const upload = await fetch(`${url}/storage/v1/object/travel-photos/${encodeURIComponent(relative).replaceAll("%2F", "/")}`, { method: "POST", headers: { ...headers, "Content-Type": /\.png$/i.test(media.path) ? "image/png" : "image/jpeg", "x-upsert": "true" }, body });
  if (!upload.ok) throw new Error(`Upload failed ${media.path}: ${upload.status} ${await upload.text()}`);
  const insert = await fetch(`${url}/rest/v1/story_media`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ story_id: storyId, kind: "photo", storage_path: storagePath, sort_order: media.order, caption: media.caption || "", alt_text: media.alt || media.path }) });
  if (!insert.ok) throw new Error(`Media link failed: ${insert.status} ${await insert.text()}`);
  done++; if (done % 25 === 0) console.log(`Imported ${done}/${tasks.length} photos...`);
}
let cursor = 0;
async function worker() { while (cursor < tasks.length) { const task = tasks[cursor++]; await processOne(task); } }
// Process only the requested batch. Keep a small worker pool to avoid API overload.
tasks.splice(0, tasks.length, ...batch);
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`Photo batch complete: offset=${offset}, limit=${limit}, ${done} uploaded, ${skipped} already linked.`);
