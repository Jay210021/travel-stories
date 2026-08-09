import { notFound } from "next/navigation";
import Breadcrumbs from "@/app/Breadcrumbs";
import PublicNavbar from "@/app/PublicNavbar";
import StoryCollection from "@/app/StoryCollection";
import { getPublicTaxon, getPublicTaxonCrumbs, listStoriesForTaxon } from "@/lib/public-reading";

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const taxon = await getPublicTaxon((await params).slug);
  if (!taxon) notFound();
  const [stories, parentCrumbs] = await Promise.all([listStoriesForTaxon(taxon), getPublicTaxonCrumbs(taxon)]);
  return <main className="min-h-screen bg-[#fdfcf8]"><PublicNavbar /><section className="mx-auto max-w-6xl px-6 py-10"><Breadcrumbs items={[{ label: "首頁", href: "/" }, ...parentCrumbs, { label: taxon.label }]} /><p className="mt-14 text-sm tracking-[0.2em] text-[#c1664b]">{taxon.kind === "destination" ? "DESTINATION" : "TOPIC"}</p><h1 className="mt-3 text-5xl font-semibold text-[#31413d]">{taxon.label}</h1><StoryCollection stories={stories} /></section></main>;
}
