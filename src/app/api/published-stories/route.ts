import { NextResponse } from "next/server";
import { getPublishedStories } from "@/lib/published-stories";
export async function GET() { return NextResponse.json({ stories: await getPublishedStories() }); }
