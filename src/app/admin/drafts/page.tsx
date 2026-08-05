import fs from "node:fs/promises";
import path from "node:path";
import DraftManager from "./DraftManager";

export default async function DraftsPage() {
  const file = path.join(process.cwd(), "docs", "facebook-drafts.json");
  const data = JSON.parse(await fs.readFile(file, "utf8"));
  return <DraftManager initialDrafts={data.drafts} />;
}
