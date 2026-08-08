import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedStories } from "@/lib/published-stories";
import ShareButton from "./ShareButton";
import ArticleEditor from "./ArticleEditor";
import ViewTracker from "./ViewTracker";

// Media paths come from Supabase Storage and include imported legacy assets.
/* eslint-disable @next/next/no-img-element */

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const story = (await getPublishedStories()).find((item) => item.slug === slug);
  if (!story) notFound();

  return <main className="min-h-screen bg-[#fdfcf8]"><ViewTracker storyId={story.id} /><nav className="mx-auto flex max-w-5xl justify-between px-6 py-7"><Link href="/" className="text-lg font-semibold tracking-[0.16em] text-[#31413d]">天天寶寶旅行趣</Link><Link href="/#stories" className="text-sm text-[#c1664b]">← 回到故事</Link></nav><article className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16"><header className="mx-auto max-w-3xl"><p className="text-xs tracking-[0.16em] text-[#c1664b]">{story.category} · {story.country ?? ""} {story.city ?? ""}</p><h1 className="mt-4 text-4xl font-semibold leading-tight text-[#31413d] sm:text-6xl">{story.title}</h1><div className="mt-6 flex gap-4 text-sm text-[#718078]"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${story.country ?? ""} ${story.city ?? ""}`)}`} target="_blank" rel="noreferrer" className="text-[#c1664b]">開啟地圖</a><ShareButton /></div><ArticleEditor sourceId={story.source_id ?? ""} title={story.title} category={story.category} country={story.country} city={story.city} /></header><div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">{story.media.map((media, index) => { const src = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${media.storage_path}`; return media.kind === "video" ? <video key={media.storage_path} src={src} controls className={`w-full rounded-2xl ${index === 0 ? "sm:col-span-2" : ""}`} /> : <figure key={media.storage_path} className={index === 0 ? "sm:col-span-2" : ""}><img src={src} alt={media.alt_text} className={`w-full rounded-2xl object-cover ${index === 0 ? "max-h-[70vh]" : "aspect-[4/3]"}`} /><figcaption className="mt-2 text-sm text-[#718078]">{media.caption}</figcaption></figure>; })}</div><div className="mx-auto mt-14 max-w-2xl whitespace-pre-wrap text-lg leading-9 text-[#667870]">{story.body}</div></article></main>;
}
