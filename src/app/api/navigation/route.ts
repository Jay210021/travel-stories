import { NextResponse } from "next/server";
import { getPublicNavigation } from "@/lib/public-reading";

export async function GET() {
  return NextResponse.json({ navigation: await getPublicNavigation() });
}
