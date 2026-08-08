import fs from "node:fs/promises";
import path from "node:path";
import FacebookImportPreview from "./FacebookImportPreview";

export default async function ImportPreviewPage() {
  const draftsPath = path.join(process.cwd(), "docs", "facebook-drafts.json");
  const data = JSON.parse(await fs.readFile(draftsPath, "utf8"));
  return <FacebookImportPreview posts={data.drafts} />;
}
