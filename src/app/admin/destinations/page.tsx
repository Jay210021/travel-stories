import { redirect } from "next/navigation";

export default function LegacyDestinationsPage() {
  redirect("/admin/content-navigation");
}
