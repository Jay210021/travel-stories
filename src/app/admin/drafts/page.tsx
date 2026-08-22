import DraftManager from "./DraftManager";
import { readLocalFacebookDrafts } from "@/lib/local-facebook-archive";

export default async function DraftsPage() {
  return <DraftManager initialDrafts={await readLocalFacebookDrafts()} />;
}
