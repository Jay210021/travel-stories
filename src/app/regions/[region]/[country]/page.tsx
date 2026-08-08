import { notFound } from "next/navigation";
import Breadcrumbs from "@/app/Breadcrumbs";
import PublicNavbar from "@/app/PublicNavbar";
import StoryCollection from "@/app/StoryCollection";
import { listStoriesForCountry } from "@/lib/public-reading";
import { countryDestinationCrumbs, findCountryRoute } from "@/lib/destination";

export default async function CountryPage({ params }: { params: Promise<{ region: string; country: string }> }) {
  const values = await params;
  const route = findCountryRoute(values.region, values.country);
  if (!route) notFound();
  const stories = await listStoriesForCountry(route.country.slug);
  return <main className="min-h-screen bg-[#fdfcf8]"><PublicNavbar /><section className="mx-auto max-w-6xl px-6 py-10"><Breadcrumbs items={[{ label: "首頁", href: "/" }, ...countryDestinationCrumbs(route)]} /><p className="mt-14 text-sm tracking-[0.2em] text-[#c1664b]">DESTINATION</p><h1 className="mt-3 text-5xl font-semibold text-[#31413d]">{route.country.label}旅行</h1><StoryCollection stories={stories} /></section></main>;
}
