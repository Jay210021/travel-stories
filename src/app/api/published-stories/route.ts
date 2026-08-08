import { NextResponse } from "next/server";
import { listStoryIndex } from "@/lib/public-reading";
export async function GET() { return NextResponse.json({ stories: await listStoryIndex() }); }
