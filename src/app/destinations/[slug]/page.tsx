import { notFound } from "next/navigation";
import Breadcrumbs from "@/app/Breadcrumbs";
import PublicNavbar from "@/app/PublicNavbar";
import StoryCollection from "@/app/StoryCollection";
import { getManagedDestination, listStoriesForManagedDestination } from "@/lib/public-reading";

export default async function ManagedDestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const destination = await getManagedDestination((await params).slug);
  if (!destination) notFound();
  const stories = await listStoriesForManagedDestination(destination);
  return <main className="min-h-screen bg-[#fdfcf8]"><PublicNavbar /><section className="mx-auto max-w-6xl px-6 py-10"><Breadcrumbs items={[{ label: "首頁", href: "/" }, { label: destination.label }]} /><p className="mt-14 text-sm tracking-[0.2em] text-[#c1664b]">DESTINATION</p><h1 className="mt-3 text-5xl font-semibold text-[#31413d]">{destination.label}旅行</h1><p className="mt-5 text-[#718078]">依照目的地整理的{destination.label}文章。</p><StoryCollection stories={stories} /></section></main>;
}
