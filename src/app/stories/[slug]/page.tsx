import { notFound } from "next/navigation";
import Breadcrumbs, { type BreadcrumbItem } from "@/app/Breadcrumbs";
import PublicNavbar from "@/app/PublicNavbar";
import { getStoryBySlug, publicMediaUrl } from "@/lib/public-reading";
import { resolveDestination, storyDestinationCrumbs } from "@/lib/destination";
import ShareButton from "./ShareButton";
import ArticleEditor from "./ArticleEditor";
import ViewTracker from "./ViewTracker";

/* eslint-disable @next/next/no-img-element */

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const story = await getStoryBySlug((await params).slug);
  if (!story) notFound();
  const destination = resolveDestination(story);
  const breadcrumbs: BreadcrumbItem[] = [{ label: "首頁", href: "/" }, ...storyDestinationCrumbs(story), { label: story.title }];
  const destinationLabel = destination?.country?.label ?? destination?.region.label ?? story.country ?? "";
  return <main className="min-h-screen bg-[#fdfcf8]"><ViewTracker storyId={story.id} /><PublicNavbar /><article className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8"><Breadcrumbs items={breadcrumbs} /><header className="mx-auto mt-12 max-w-3xl"><p className="text-xs tracking-[0.16em] text-[#c1664b]">{story.category} · {destinationLabel} {story.city ?? ""}</p><h1 className="mt-4 text-4xl font-semibold leading-tight text-[#31413d] sm:text-6xl">{story.title}</h1><div className="mt-6 flex gap-4 text-sm text-[#718078]"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${story.country ?? ""} ${story.city ?? ""}`)}`} target="_blank" rel="noreferrer" className="text-[#c1664b]">開啟地圖</a><ShareButton /></div><ArticleEditor storyId={story.id} sourceId={story.source_id ?? ""} title={story.title} category={story.category} country={story.country} city={story.city} /></header><div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">{story.media.map((media, index) => { const src = publicMediaUrl(media.storage_path); return media.kind === "video" ? <video key={media.storage_path} src={src} controls className={`w-full rounded-2xl ${index === 0 ? "sm:col-span-2" : ""}`} /> : <figure key={media.storage_path} className={index === 0 ? "sm:col-span-2" : ""}><img src={src} alt={media.alt_text} className={`w-full rounded-2xl object-cover ${index === 0 ? "max-h-[70vh]" : "aspect-[4/3]"}`} /><figcaption className="mt-2 text-sm text-[#718078]">{media.caption}</figcaption></figure>; })}</div><div className="mx-auto mt-14 max-w-2xl whitespace-pre-wrap text-lg leading-9 text-[#667870]">{story.body}</div></article></main>;
}
