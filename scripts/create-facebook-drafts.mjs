import fs from "node:fs";
import path from "node:path";

const inputPath = path.join(process.cwd(), "docs", "facebook-import-preview.json");
const outputPath = path.join(process.cwd(), "docs", "facebook-drafts.json");
const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const drafts = source.posts.map((post) => ({
  draftId: post.importId,
  status: "draft",
  source: "facebook",
  title: post.title || "未命名 Facebook 貼文",
  body: post.text,
  publishedAt: post.date,
  country: null,
  city: null,
  media: post.mediaLinks.map((filePath, index) => ({ path: filePath, order: index, isCover: index === 0, caption: "", alt: "" })),
  review: { needsLocation: true, needsPrivacyCheck: true, readyToPublish: false },
}));

const result = { generatedAt: new Date().toISOString(), source: source.source, totals: { drafts: drafts.length }, drafts };
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify(result.totals, null, 2));
console.log(`Drafts written to ${path.relative(process.cwd(), outputPath)}`);
