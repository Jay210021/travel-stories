import { notFound } from "next/navigation";
import Breadcrumbs from "@/app/Breadcrumbs";
import PublicNavbar from "@/app/PublicNavbar";
import StoryCollection from "@/app/StoryCollection";
import { listStoriesForRegion } from "@/lib/public-reading";
import { findRegion, regionDestinationCrumbs } from "@/lib/destination";

export default async function RegionPage({ params }: { params: Promise<{ region: string }> }) {
  const region = findRegion((await params).region);
  if (!region) notFound();
  const stories = await listStoriesForRegion(region.slug);
  return <main className="min-h-screen bg-[#fdfcf8]"><PublicNavbar /><section className="mx-auto max-w-6xl px-6 py-10"><Breadcrumbs items={[{ label: "首頁", href: "/" }, ...regionDestinationCrumbs(region)]} /><p className="mt-14 text-sm tracking-[0.2em] text-[#c1664b]">TRAVEL STORIES</p><h1 className="mt-3 text-5xl font-semibold text-[#31413d]">{region.label}旅行</h1><p className="mt-5 text-[#718078]">依照目的地整理的{region.label}旅行文章。</p><StoryCollection stories={stories} /></section></main>;
}
