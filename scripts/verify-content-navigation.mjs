import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL; const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Supabase public configuration is missing.");
const supabase = createClient(url, key);
const { data, error } = await supabase.from("content_taxa").select("id,slug,label,kind,parent_id,show_in_nav,sort_order,href").order("sort_order");
if (error) throw new Error(`content_taxa query failed: ${error.message}`);
const items = data ?? []; const ids = new Set(items.map((item) => item.id)); const problems = [];
if (!items.some((item) => item.slug === "daily-life" && item.kind === "topic" && !item.href)) problems.push("missing topic item: daily-life");
if (!items.some((item) => item.slug === "videos" && item.kind === "system" && item.href)) problems.push("missing system item: videos");
for (const item of items) { if (item.parent_id && !ids.has(item.parent_id)) problems.push(`orphan classification: ${item.label}`); if (item.kind === "system" && (item.parent_id || !item.href)) problems.push(`invalid system item: ${item.label}`); }
const siblingLabels = new Set(); for (const item of items) { const keyValue = `${item.parent_id ?? "root"}:${item.label.toLowerCase()}`; if (siblingLabels.has(keyValue)) problems.push(`duplicate sibling label: ${item.label}`); siblingLabels.add(keyValue); }
if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; } else console.log(`content navigation verified: ${items.length} items, ${items.filter((item) => item.show_in_nav).length} visible`);
