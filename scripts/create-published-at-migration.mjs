import fs from "node:fs";
import path from "node:path";

const source = path.resolve("docs/facebook-drafts.json");
const destination = path.resolve("supabase/migrations/003_backfill_facebook_published_at.sql");
const drafts = JSON.parse(fs.readFileSync(source, "utf8")).drafts;
const sqlValue = (value) => `'${String(value).replaceAll("'", "''")}'`;

const invalid = drafts.filter((draft) => !draft.publishedAt || Number.isNaN(Date.parse(draft.publishedAt)));
if (invalid.length) throw new Error(`Found ${invalid.length} drafts without a valid publishedAt value.`);

const values = drafts
  .map((draft) => `  (${sqlValue(draft.draftId)}, ${sqlValue(draft.publishedAt)}::timestamptz)`)
  .join(",\n");

const migration = `-- Generated from docs/facebook-drafts.json.\n-- Backfills the original Facebook publication time without changing story status.\nupdate public.stories as story\nset published_at = source.published_at, updated_at = now()\nfrom (values\n${values}\n) as source(source_id, published_at)\nwhere story.source_id = source.source_id;\n`;

fs.writeFileSync(destination, migration, "utf8");
console.log(`Generated ${destination} with ${drafts.length} publication dates.`);
