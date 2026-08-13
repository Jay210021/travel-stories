import fs from "node:fs/promises";
import path from "node:path";
import FacebookImportDashboard from "./FacebookImportDashboard";
import LegacyFacebookArchiveImport, { type ArchivedFacebookPost } from "./LegacyFacebookArchiveImport";

export default async function FacebookImportPage() {
  const archive = JSON.parse(await fs.readFile(path.join(process.cwd(), "docs", "facebook-drafts.json"), "utf8")) as { drafts: ArchivedFacebookPost[] };
  return <><FacebookImportDashboard/><LegacyFacebookArchiveImport posts={archive.drafts}/></>;
}
