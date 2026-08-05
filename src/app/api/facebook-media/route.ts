import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const exportRoot = path.resolve(process.cwd(), "../facebook-export");
const types: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".mp4": "video/mp4", ".mov": "video/quicktime" };

export async function GET(request: NextRequest) {
  const relativePath = request.nextUrl.searchParams.get("path");
  if (!relativePath) return NextResponse.json({ error: "Missing path" }, { status: 400 });
  const target = path.resolve(exportRoot, relativePath);
  if (!target.startsWith(`${exportRoot}${path.sep}`)) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  try {
    const data = await fs.readFile(target);
    return new NextResponse(data, { headers: { "Content-Type": types[path.extname(target).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "private, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
}
