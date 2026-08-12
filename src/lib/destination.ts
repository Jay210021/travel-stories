export type RegionSlug = "europe" | "asia" | "africa" | "taiwan";
type Region = { slug: RegionSlug; label: string; href: string };
type Country = { slug: string; label: string; region: RegionSlug; aliases: string[]; href: string };
export type DestinationStory = { title: string; body: string; country: string | null };
export type DestinationCrumb = { label: string; href?: string };
export type ResolvedDestination = { region: Region; country?: Omit<Country, "aliases"> };
export type DestinationNavigation = { slug: RegionSlug; label: string; countries: { slug: string; label: string }[] }[];

const regionDefinitions: Omit<Region, "href">[] = [
  { slug: "europe", label: "歐洲" }, { slug: "asia", label: "亞洲" }, { slug: "africa", label: "非洲" }, { slug: "taiwan", label: "台灣" },
];
const regions: Region[] = regionDefinitions.map((region) => ({ ...region, href: `/regions/${region.slug}` }));
const countryDefinitions: Omit<Country, "href">[] = [
  { slug: "taiwan", label: "台灣", region: "taiwan", aliases: ["台灣", "臺灣", "台北", "臺北", "新北", "桃園", "屏東", "恆春", "花蓮", "合歡", "九份", "墾丁"] },
  { slug: "italy", label: "義大利", region: "europe", aliases: ["義大利", "米蘭", "威尼斯", "維洛納", "佛羅倫斯", "羅馬"] }, { slug: "croatia", label: "克羅埃西亞", region: "europe", aliases: ["克羅埃西亞", "杜布羅夫尼克", "dubrovnik", "札達爾", "zadar", "split", "十六湖", "16湖"] }, { slug: "slovenia", label: "斯洛維尼亞", region: "europe", aliases: ["斯洛維尼亞", "盧布爾雅那"] }, { slug: "montenegro", label: "蒙特內哥羅", region: "europe", aliases: ["蒙特內哥羅", "黑山", "kotor"] }, { slug: "hungary", label: "匈牙利", region: "europe", aliases: ["匈牙利", "布達佩斯"] }, { slug: "poland", label: "波蘭", region: "europe", aliases: ["波蘭", "克拉科夫", "札科帕內", "樂斯拉夫", "奧斯威辛"] }, { slug: "czechia", label: "捷克", region: "europe", aliases: ["捷克", "布拉格"] }, { slug: "germany", label: "德國", region: "europe", aliases: ["德國", "國王湖"] }, { slug: "austria", label: "奧地利", region: "europe", aliases: ["奧地利", "維也納", "薩爾斯堡", "哈修塔特"] }, { slug: "slovakia", label: "斯洛伐克", region: "europe", aliases: ["斯洛伐克", "布拉提斯拉瓦"] }, { slug: "spain", label: "西班牙", region: "europe", aliases: ["西班牙", "巴塞隆", "馬德里", "托雷多", "佛朗明哥", "flamenco"] }, { slug: "portugal", label: "葡萄牙", region: "europe", aliases: ["葡萄牙", "里斯本", "波多", "辛特拉", "obidos"] }, { slug: "greece", label: "希臘", region: "europe", aliases: ["希臘", "雅典", "聖托里尼", "oia"] },
  { slug: "south-korea", label: "韓國", region: "asia", aliases: ["韓國", "首爾", "弘大", "江南", "廣藏市場", "南怡島"] }, { slug: "vietnam", label: "越南", region: "asia", aliases: ["越南", "峴港", "會安", "河內", "沙壩", "下龍灣", "番西邦"] }, { slug: "thailand", label: "泰國", region: "asia", aliases: ["泰國", "曼谷"] }, { slug: "laos", label: "寮國", region: "asia", aliases: ["寮國", "龍坡邦", "關西瀑布"] }, { slug: "india", label: "印度", region: "asia", aliases: ["印度", "孟買", "新德里", "德里", "拉達克", "列城", "瓦拉納西", "阿格拉", "齋浦爾", "烏代浦", "泰姬瑪哈陵"] }, { slug: "china", label: "中國", region: "asia", aliases: ["中國", "大陸", "四川", "重慶", "九寨溝", "黃龍景區"] }, { slug: "united-arab-emirates", label: "阿拉伯聯合大公國", region: "asia", aliases: ["阿拉伯聯合大公國", "阿聯酋", "杜拜", "阿布達比"] }, { slug: "turkey", label: "土耳其", region: "asia", aliases: ["土耳其", "伊斯坦堡", "卡帕多奇亞", "棉堡", "庫薩達西", "伊士麥", "阿拉恰特"] },
  { slug: "egypt", label: "埃及", region: "africa", aliases: ["埃及", "開羅", "金字塔", "帝王谷", "尼羅河", "黑白沙漠"] }, { slug: "kenya", label: "肯亞", region: "africa", aliases: ["肯亞", "奈洛比", "safari", "longonot"] },
];
const countries: Country[] = countryDefinitions.map((country) => ({ ...country, href: `/regions/${country.region}/${country.slug}` }));

function countryIn(content: string) { const normalized = content.toLowerCase(); return countries.find((country) => country.aliases.some((alias) => normalized.includes(alias.toLowerCase()))) ?? null; }
function resolved(country: Country): ResolvedDestination { const region = regions.find((item) => item.slug === country.region)!; return { region, ...(country.slug === region.slug ? {} : { country: { slug: country.slug, label: country.label, region: country.region, href: country.href } }) }; }

export function resolveDestination(story: DestinationStory): ResolvedDestination | null {
  const country = (story.country && countryIn(story.country)) || countryIn(story.title) || countryIn(story.body);
  return country ? resolved(country) : null;
}

export function findRegion(slug: string) { return regions.find((region) => region.slug === slug) ?? null; }
export function findCountryRoute(regionSlug: string, countrySlug: string) { const region = findRegion(regionSlug); const country = countries.find((item) => item.slug === countrySlug && item.region === regionSlug); return region && country ? { region, country: resolved(country).country ?? { slug: country.slug, label: country.label, region: country.region, href: region.href } } : null; }
export function storyDestinationCrumbs(story: DestinationStory): DestinationCrumb[] { const destination = resolveDestination(story); return destination ? [destination.region, ...(destination.country ? [destination.country] : [])] : []; }
export function regionDestinationCrumbs(region: Region): DestinationCrumb[] { return [{ label: region.label }]; }
export function countryDestinationCrumbs(route: NonNullable<ReturnType<typeof findCountryRoute>>): DestinationCrumb[] { return [{ label: route.region.label, href: route.region.href }, ...(route.country.slug === route.region.slug ? [] : [{ label: route.country.label }])]; }
export function emptyDestinationNavigation(): DestinationNavigation { return regions.map(({ slug, label }) => ({ slug, label, countries: [] })); }
export function destinationNavigation(stories: DestinationStory[]): DestinationNavigation { const available = new Set(stories.map(resolveDestination).filter(Boolean).map((destination) => destination!.country?.slug ?? destination!.region.slug)); return regions.map(({ slug, label }) => ({ slug, label, countries: countries.filter((country) => country.region === slug && country.slug !== slug && available.has(country.slug)).map(({ slug: countrySlug, label: countryLabel }) => ({ slug: countrySlug, label: countryLabel })) })); }
