const categories = [
  { label: "國外旅行", count: "世界各地", tone: "from-[#d97757] to-[#f3c892]", icon: "✈️" },
  { label: "台灣旅行", count: "島嶼日常", tone: "from-[#5f8f86] to-[#b7d8c5]", icon: "🌊" },
  { label: "日常生活", count: "兩人的片段", tone: "from-[#b88568] to-[#e9c8a8]", icon: "☕" },
];

const stories = [
  { place: "義大利・米蘭", title: "在米蘭大教堂，遇見一場細雨", excerpt: "城市的石板路、屋頂上的尖塔，還有我們在雨裡留下的腳印。", date: "2025.01.26", tone: "from-[#7d9ab6] via-[#d8c5bd] to-[#687c8f]" },
  { place: "克羅埃西亞・杜布羅夫尼克", title: "沿著亞得里亞海走過古城牆", excerpt: "九天自駕旅程的最後一站，藍色海灣把旅途拉成很長很長的午後。", date: "2025.01.15", tone: "from-[#407f9d] via-[#87c2d0] to-[#e2b57f]" },
  { place: "台灣・屏東恆春", title: "海風吹來的週末小旅行", excerpt: "不用趕行程的兩天一夜，也可以把日子過得很有風景。", date: "2024.05.24", tone: "from-[#66a4b4] via-[#d7ebef] to-[#e6b878]" },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7 lg:px-10">
        <a href="#top" className="text-lg font-semibold tracking-[0.16em] text-[#31413d]">天天寶寶旅行趣</a>
        <div className="hidden items-center gap-8 text-sm text-[#61716c] sm:flex">
          <a href="#stories" className="transition hover:text-[#c1664b]">最新故事</a>
          <a href="#categories" className="transition hover:text-[#c1664b]">探索分類</a>
          <a href="#about" className="transition hover:text-[#c1664b]">關於我們</a>
        </div>
        <button className="rounded-full border border-[#cad8d0] px-4 py-2 text-sm text-[#4c655d] transition hover:border-[#c1664b] hover:text-[#c1664b]">搜尋故事</button>
      </nav>

      <section id="top" className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1fr_0.9fr] lg:px-10 lg:pb-28 lg:pt-20">
        <div>
          <p className="mb-6 text-sm font-medium tracking-[0.25em] text-[#c1664b]">OUR LITTLE TRAVEL ARCHIVE</p>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.12] tracking-[-0.04em] text-[#31413d] sm:text-7xl">
            把走過的地方，<span className="text-[#c1664b]">好好記下來。</span>
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-[#687a73]">這裡是天天寶寶的旅行故事，也是一個把風景、食物和我們一起走過的日子收藏起來的地方。</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#stories" className="rounded-full bg-[#c1664b] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-[#c1664b]/20 transition hover:-translate-y-0.5 hover:bg-[#ad533e]">開始閱讀故事</a>
            <a href="#categories" className="rounded-full border border-[#cbd9d1] bg-white/60 px-6 py-3 text-sm font-medium text-[#4d655d] transition hover:border-[#c1664b]">探索旅行地圖</a>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -left-7 top-12 h-24 w-24 rounded-full bg-[#f0cda0]/60 blur-2xl" />
          <div className="relative aspect-[4/5] rotate-2 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#7ba3a1] via-[#d9c4a6] to-[#d77b5c] p-4 shadow-2xl shadow-[#6b7b70]/20">
            <div className="flex h-full flex-col justify-between rounded-[1.5rem] border border-white/50 bg-white/10 p-6 text-white backdrop-blur-[2px]">
              <div className="flex justify-between text-xs tracking-[0.2em]"><span>TRAVEL NOTES</span><span>2024—25</span></div>
              <div><p className="text-6xl">🌍</p><p className="mt-5 text-3xl font-semibold leading-tight">半年環遊世界<br />的那些日子</p><p className="mt-3 text-sm text-white/80">everywhere we went, together</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="categories" className="bg-[#eaf0eb]/70 px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-6xl"><div className="mb-10 flex items-end justify-between"><div><p className="text-sm tracking-[0.2em] text-[#c1664b]">EXPLORE</p><h2 className="mt-2 text-3xl font-semibold text-[#31413d] sm:text-4xl">從哪一段故事開始？</h2></div><span className="hidden text-sm text-[#7a8b83] sm:block">三種方式，收藏我們的日子</span></div>
          <div className="grid gap-5 md:grid-cols-3">{categories.map((category) => <a href="#stories" key={category.label} className="group overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className={`flex h-40 items-end justify-between bg-gradient-to-br ${category.tone} p-6 text-white`}><span className="text-5xl transition group-hover:scale-110">{category.icon}</span><span className="text-sm text-white/80">{category.count}</span></div><div className="p-6"><h3 className="text-xl font-semibold text-[#31413d]">{category.label}</h3><p className="mt-2 text-sm text-[#7a8b83]">看看我們在這裡留下的故事 <span className="ml-2 text-[#c1664b]">→</span></p></div></a>)}</div>
        </div>
      </section>

      <section id="stories" className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-28"><div className="mb-10 flex items-end justify-between"><div><p className="text-sm tracking-[0.2em] text-[#c1664b]">LATEST STORIES</p><h2 className="mt-2 text-3xl font-semibold text-[#31413d] sm:text-4xl">最近寫下的風景</h2></div><a href="#categories" className="text-sm text-[#c1664b] hover:underline">看全部故事 →</a></div><div className="grid gap-8 md:grid-cols-3">{stories.map((story) => <article key={story.title} className="group"><div className={`relative aspect-[4/3] overflow-hidden rounded-3xl bg-gradient-to-br ${story.tone} p-5 shadow-sm`}><div className="flex h-full items-end rounded-2xl border border-white/30 bg-black/5 p-5"><span className="text-sm font-medium text-white/90">{story.place}</span></div><span className="absolute right-5 top-5 rounded-full bg-white/80 px-3 py-1 text-xs text-[#53645d]">故事</span></div><p className="mt-5 text-xs tracking-[0.12em] text-[#c1664b]">{story.date} ・ {story.place}</p><h3 className="mt-2 text-xl font-semibold leading-snug text-[#31413d] transition group-hover:text-[#c1664b]">{story.title}</h3><p className="mt-2 text-sm leading-6 text-[#78877f]">{story.excerpt}</p></article>)}</div></section>

      <section id="about" className="bg-[#31413d] px-6 py-16 text-white lg:px-10"><div className="mx-auto flex max-w-6xl flex-col justify-between gap-8 sm:flex-row sm:items-end"><div><p className="text-sm tracking-[0.2em] text-[#f0c28f]">ABOUT US</p><h2 className="mt-3 text-3xl font-semibold">嗨，我們是天天寶寶。</h2><p className="mt-4 max-w-md leading-7 text-white/65">喜歡一起出發，也喜歡回家後慢慢整理那些照片和故事。謝謝你來到這裡。</p></div><p className="text-sm text-white/45">一個屬於我們，也分享給你的旅行檔案。</p></div></section>
    </main>
  );
}
