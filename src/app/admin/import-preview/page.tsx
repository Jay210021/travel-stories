import FacebookImportDashboard from "./FacebookImportDashboard";
import LegacyFacebookArchiveImport, { type ArchivedFacebookPost } from "./LegacyFacebookArchiveImport";
import { readLocalFacebookDrafts } from "@/lib/local-facebook-archive";

export default async function FacebookImportPage() {
  const posts = await readLocalFacebookDrafts<ArchivedFacebookPost>();
  return <><FacebookImportDashboard/><LegacyFacebookArchiveImport posts={posts}/></>;
}
