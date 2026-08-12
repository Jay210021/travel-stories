import Link from "next/link";
import type { PublicStoryCard } from "@/lib/public-reading";

export default function StoryCollection({ stories, emptyMessage = "這個分類目前還沒有文章。" }: { stories: PublicStoryCard[]; emptyMessage?: string }) {
  if (!stories.length) return <p className="mt-10 rounded-3xl bg-white p-10 text-center text-[#718078]">{emptyMessage}</p>;
  return <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">{stories.map((story) => <article key={story.id} className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-xs text-[#c1664b]">{story.classification_labels.join(" · ")}</p><h2 className="mt-3 text-2xl font-semibold text-[#31413d]"><Link href={`/stories/${story.slug}`} className="hover:text-[#c1664b]">{story.title}</Link></h2><p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-7 text-[#718078]">{story.body}</p><Link href={`/stories/${story.slug}`} className="mt-5 inline-block text-sm text-[#c1664b]">閱讀文章 →</Link></article>)}</div>;
}
