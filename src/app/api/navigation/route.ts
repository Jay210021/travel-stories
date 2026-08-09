import { NextResponse } from "next/server";
import { getPublicNavbarItems } from "@/lib/public-reading";

export async function GET() {
  return NextResponse.json({ items: await getPublicNavbarItems() });
}
