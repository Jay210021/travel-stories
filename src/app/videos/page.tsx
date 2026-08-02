import Link from "next/link";

const videos = [
  { title: "杜布羅夫尼克的海風", place: "克羅埃西亞・杜布羅夫尼克", tone: "from-[#407f9d] via-[#87c2d0] to-[#e2b57f]", category: "國外旅行" },
  { title: "恆春海邊的午後", place: "台灣・屏東恆春", tone: "from-[#66a4b4] via-[#d7ebef] to-[#e6b878]", category: "台灣旅行" },
];

export default function VideosPage() {
  return <main className="min-h-screen bg-[#fdfcf8] px-6 py-8"><nav className="mx-auto flex max-w-6xl justify-between"><Link href="/" className="text-lg font-semibold tracking-[0.16em] text-[#31413d]">天天寶寶旅行趣</Link><Link href="/" className="text-sm text-[#c1664b]">← 回首頁</Link></nav><section className="mx-auto max-w-6xl py-16"><p className="text-sm tracking-[0.2em] text-[#c1664b]">MOVING MEMORIES</p><h1 className="mt-3 text-5xl font-semibold text-[#31413d]">影片專區</h1><p className="mt-5 max-w-xl leading-7 text-[#718078]">把風景播放出來，重新聽見當時的風、街上的聲音，還有我們的笑聲。</p><div className="mt-12 grid gap-8 md:grid-cols-2">{videos.map((video) => <article key={video.title}><div className={`relative flex aspect-video items-end overflow-hidden rounded-3xl bg-gradient-to-br ${video.tone} p-6 shadow-sm`}><div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/85 text-xl text-[#c1664b]">▶</div><span className="absolute right-5 top-5 rounded-full bg-white/80 px-3 py-1 text-xs text-[#53645d]">{video.category}</span><span className="absolute bottom-6 left-20 text-sm font-medium text-white">{video.place}</span></div><h2 className="mt-5 text-xl font-semibold text-[#31413d]">{video.title}</h2><p className="mt-2 text-sm text-[#7a8b83]">旅行中的一個片段，稍後會連結到 Cloudflare Stream 播放。</p></article>)}</div></section></main>;
}
