import fs from "node:fs/promises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) before importing.");

const drafts = JSON.parse(await fs.readFile(new URL("../docs/facebook-drafts.json", import.meta.url), "utf8")).drafts;
const response = await fetch(`${url}/rest/v1/stories?on_conflict=source_id`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify(drafts.map((draft) => ({ source: "facebook", source_id: draft.draftId, title: draft.title, body: draft.body, category: draft.category, published_at: null, status: "draft" }))),
});
if (!response.ok) throw new Error(`Supabase import failed (${response.status}): ${await response.text()}`);
console.log(`Imported ${drafts.length} draft stories.`);
