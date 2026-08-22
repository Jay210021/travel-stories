import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

export async function readLocalFacebookDrafts<T>(): Promise<T[]> {
  if (process.env.NODE_ENV !== "development") return [];
  try {
    const file = path.join(process.cwd(), "docs", "facebook-drafts.json");
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as { drafts?: unknown };
    return Array.isArray(parsed.drafts) ? parsed.drafts as T[] : [];
  } catch {
    return [];
  }
}
