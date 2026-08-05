import fs from "node:fs/promises";
import path from "node:path";
import FacebookImportPreview from "./FacebookImportPreview";

export default async function ImportPreviewPage() {
  const previewPath = path.join(process.cwd(), "docs", "facebook-import-preview.json");
  const preview = JSON.parse(await fs.readFile(previewPath, "utf8"));
  return <FacebookImportPreview posts={preview.posts} />;
}
