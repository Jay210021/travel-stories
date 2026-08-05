import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const exportRoot = path.resolve(projectRoot, "../facebook-export");
const postsFile = path.join(exportRoot, "this_profile's_activity_across_facebook", "posts", "profile_posts_1.json");
const mediaRoot = path.join(exportRoot, "this_profile's_activity_across_facebook", "posts", "media");

function walk(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) return value.flatMap((item) => walk(item, result));
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && (key === "uri" || key === "href" || key === "path" || key === "media_uri")) result.push(child);
    else if (typeof child === "object") walk(child, result);
  }
  return result;
}

function textFromPost(post) {
  const values = [];
  const collect = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(collect);
    for (const [key, child] of Object.entries(value)) {
      if ((key === "post" || key === "message" || key === "text" || key === "description") && typeof child === "string") values.push(child);
      else if (typeof child === "object") collect(child);
    }
  };
  collect(post.data);
  return [...new Set(values)].join("\n\n").trim();
}

function repairEncoding(value) {
  if (!value || !/[Ãåæçéè]/.test(value)) return value;
  try { return Buffer.from(value, "latin1").toString("utf8"); } catch { return value; }
}

function mediaFiles() {
  const files = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (/\.(jpe?g|png|gif|webp|mp4|mov|webm)$/i.test(entry.name)) files.push(path.relative(projectRoot, fullPath).replaceAll("\\", "/"));
    }
  };
  visit(mediaRoot);
  return files;
}

const posts = JSON.parse(fs.readFileSync(postsFile, "utf8"));
const allMedia = mediaFiles();
const preview = posts.map((post, index) => {
  const links = walk(post.attachments ?? []);
  const linkedMedia = links.filter((link) => /\.(jpe?g|png|gif|webp|mp4|mov|webm)(\?|$)/i.test(link));
  return {
    importId: `facebook-${index + 1}`,
    timestamp: post.timestamp ?? null,
    date: post.timestamp ? new Date(post.timestamp * 1000).toISOString() : null,
    title: repairEncoding(post.title ?? ""),
    text: repairEncoding(textFromPost(post)),
    mediaLinks: linkedMedia,
    rawAttachmentCount: Array.isArray(post.attachments) ? post.attachments.length : 0,
  };
});

const output = {
  generatedAt: new Date().toISOString(),
  source: path.relative(projectRoot, postsFile).replaceAll("\\", "/"),
  totals: { posts: preview.length, postsWithText: preview.filter((post) => post.text).length, postsWithMediaLinks: preview.filter((post) => post.mediaLinks.length).length, exportedMediaFiles: allMedia.length },
  posts: preview,
};

const outputPath = path.join(projectRoot, "docs", "facebook-import-preview.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
console.log(JSON.stringify(output.totals, null, 2));
console.log(`Preview written to ${path.relative(projectRoot, outputPath)}`);
