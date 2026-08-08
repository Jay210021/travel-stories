import Link from "next/link";
import Breadcrumbs from "@/app/Breadcrumbs";
import PublicNavbar from "@/app/PublicNavbar";
import { listVideos, publicMediaUrl } from "@/lib/public-reading";

export default async function VideosPage() {
  const videos = await listVideos();
  return <main className="min-h-screen bg-[#fdfcf8]"><PublicNavbar /><section className="mx-auto max-w-6xl px-6 py-10"><Breadcrumbs items={[{ label: "首頁", href: "/" }, { label: "影片專區" }]} /><div className="pt-12"><p className="text-sm tracking-[0.2em] text-[#c1664b]">MOVING MEMORIES</p><h1 className="mt-3 text-5xl font-semibold text-[#31413d]">影片專區</h1><p className="mt-5 max-w-xl leading-7 text-[#718078]">把風景播放出來，重新聽見當時的風、街上的聲音，還有我們的笑聲。</p><div className="mt-12 grid gap-8 md:grid-cols-2">{videos.map((video) => <article key={video.storage_path} className="overflow-hidden rounded-3xl bg-white shadow-sm"><video src={publicMediaUrl(video.storage_path)} controls preload="metadata" className="aspect-video w-full bg-[#31413d]" /><div className="p-5"><p className="text-xs text-[#c1664b]">{video.story.category}{video.story.country ? ` · ${video.story.country}` : ""} {video.story.city ?? ""}</p><h2 className="mt-2 text-xl font-semibold text-[#31413d]">{video.alt_text || video.story.title}</h2><p className="mt-2 text-sm text-[#7a8b83]">{video.caption}</p><Link href={`/stories/${video.story.slug}`} className="mt-4 inline-block text-sm text-[#c1664b]">閱讀相關文章 →</Link></div></article>)}</div>{!videos.length && <p className="mt-12 rounded-3xl bg-white p-10 text-center text-[#7a8b83]">目前還沒有已發布的影片。</p>}</div></section></main>;
}
