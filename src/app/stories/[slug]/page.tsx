import Link from "next/link";
import { notFound } from "next/navigation";
import { getStory, stories } from "@/lib/stories";

export function generateStaticParams() { return stories.map((story) => ({ slug: story.slug })); }

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const story = getStory((await params).slug);
  if (!story) notFound();
  return <main className="min-h-screen"><nav className="mx-auto flex max-w-4xl justify-between px-6 py-7"><Link href="/" className="text-lg font-semibold tracking-[0.16em] text-[#31413d]">天天寶寶旅行趣</Link><Link href="/#stories" className="text-sm text-[#c1664b]">← 回到故事列表</Link></nav><article className="mx-auto max-w-4xl px-6 pb-24 pt-10"><div className={`flex aspect-[16/8] items-end rounded-[2rem] bg-gradient-to-br ${story.tone} p-8 text-white shadow-xl sm:p-12`}><div><p className="text-sm tracking-[0.16em] text-white/80">{story.category} ・ {story.date}</p><h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-6xl">{story.title}</h1></div></div><div className="mx-auto max-w-2xl"><div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-[#718078]"><span>📍 {story.country}・{story.city}</span><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${story.country} ${story.city}`)}`} target="_blank" rel="noreferrer" className="text-[#c1664b] hover:underline">在地圖上查看 →</a></div><p className="mt-8 text-xl leading-9 text-[#52655d]">{story.excerpt}</p><div className="mt-8 space-y-6 text-lg leading-9 text-[#667870]">{story.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></div></article></main>;
}
