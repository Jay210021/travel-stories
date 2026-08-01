export type Story = {
  slug: string;
  category: "國外旅行" | "台灣旅行" | "日常生活";
  place: string;
  country: string;
  city: string;
  title: string;
  excerpt: string;
  date: string;
  tone: string;
  paragraphs: string[];
};

export const stories: Story[] = [
  { slug: "milan-cathedral-rain", category: "國外旅行", place: "義大利・米蘭", country: "義大利", city: "米蘭", title: "在米蘭大教堂，遇見一場細雨", excerpt: "城市的石板路、屋頂上的尖塔，還有我們在雨裡留下的腳印。", date: "2025.01.26", tone: "from-[#7d9ab6] via-[#d8c5bd] to-[#687c8f]", paragraphs: ["米蘭的天氣比想像中更有自己的脾氣。早上還有一點陽光，走到大教堂廣場時，細雨已經悄悄落下。", "我們沒有急著躲進室內，反而買了兩杯熱咖啡，沿著石板路慢慢走。雨讓整座城市變得安靜，尖塔像是從灰藍色天空裡長出來。"] },
  { slug: "dubrovnik-old-city", category: "國外旅行", place: "克羅埃西亞・杜布羅夫尼克", country: "克羅埃西亞", city: "杜布羅夫尼克", title: "沿著亞得里亞海走過古城牆", excerpt: "九天自駕旅程的最後一站，藍色海灣把旅途拉成很長很長的午後。", date: "2025.01.15", tone: "from-[#407f9d] via-[#87c2d0] to-[#e2b57f]", paragraphs: ["杜布羅夫尼克的古城牆比照片裡更有重量。每走一段，就能看見紅屋頂、海灣和遠方的小島。", "我們把最後一個下午留給城牆，沒有安排下一個景點，只是邊走邊聊天，讓九天的自駕旅程慢慢停下來。"] },
  { slug: "hengchun-weekend", category: "台灣旅行", place: "台灣・屏東恆春", country: "台灣", city: "恆春", title: "海風吹來的週末小旅行", excerpt: "不用趕行程的兩天一夜，也可以把日子過得很有風景。", date: "2024.05.24", tone: "from-[#66a4b4] via-[#d7ebef] to-[#e6b878]", paragraphs: ["有時候旅行不需要跨過海，只要把週末空下來，往南走一點。恆春的風很大，剛好把平常累積的忙碌吹散。", "我們住在靠海的房間，早上被陽光叫醒，晚上再到街上找一間喜歡的小店。行程很少，但記得的事情很多。"] },
];

export function getStory(slug: string) { return stories.find((story) => story.slug === slug); }
