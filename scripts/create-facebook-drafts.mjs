import fs from "node:fs";
import path from "node:path";

const inputPath = path.join(process.cwd(), "docs", "facebook-import-preview.json");
const outputPath = path.join(process.cwd(), "docs", "facebook-drafts.json");
const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const taiwanTerms = ["台灣", "桃園", "台北", "新北", "台中", "台南", "高雄", "屏東", "花蓮", "宜蘭", "墾丁", "恆春", "基隆", "新竹", "苗栗", "彰化", "南投", "雲林", "嘉義"];
const foreignTerms = ["印度", "新德里", "米蘭", "義大利", "克羅埃西亞", "杜布羅夫尼克", "法國", "巴黎", "英國", "倫敦", "西班牙", "巴塞隆納", "葡萄牙", "希臘", "土耳其", "日本", "東京", "京都", "大阪", "韓國", "首爾", "泰國", "曼谷", "越南", "河內", "新加坡", "馬來西亞", "美國", "紐約", "加拿大", "澳洲", "埃及", "摩洛哥", "冰島", "瑞士", "德國", "荷蘭", "奧地利", "捷克", "匈牙利", "波蘭", "斯洛維尼亞", "塞爾維亞", "黑山", "羅馬尼亞", "保加利亞", "印尼", "峇里島", "歐洲", "亞洲", "美洲"];
const dailyTerms = ["工作", "生活", "講座", "按摩", "課程", "生日", "日常"];

function categoryFor(post) {
  const content = `${post.title} ${post.text}`;
  if (foreignTerms.some((term) => content.includes(term))) return "國外旅行";
  if (taiwanTerms.some((term) => content.includes(term))) return "台灣旅行";
  if (dailyTerms.some((term) => content.includes(term))) return "日常生活";
  return "國外旅行";
}

const drafts = source.posts.map((post) => ({
  draftId: post.importId,
  status: "draft",
  source: "facebook",
  title: post.title || "未命名 Facebook 貼文",
  body: post.text,
  publishedAt: post.date,
  category: categoryFor(post),
  country: null,
  city: null,
  media: post.mediaLinks.map((filePath, index) => ({ path: filePath, order: index, isCover: index === 0, caption: "", alt: "" })),
  review: { needsLocation: true, needsPrivacyCheck: true, readyToPublish: false },
}));

const result = { generatedAt: new Date().toISOString(), source: source.source, totals: { drafts: drafts.length, foreignTravel: drafts.filter((draft) => draft.category === "國外旅行").length, taiwanTravel: drafts.filter((draft) => draft.category === "台灣旅行").length, dailyLife: drafts.filter((draft) => draft.category === "日常生活").length }, drafts };
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify(result.totals, null, 2));
console.log(`Drafts written to ${path.relative(process.cwd(), outputPath)}`);
