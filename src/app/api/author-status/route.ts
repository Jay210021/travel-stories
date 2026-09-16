import { getAuthorContext } from "@/lib/author-access";

export async function GET() {
  const isAuthor = Boolean(await getAuthorContext());
  return Response.json({ isAuthor }, { headers: { "Cache-Control": "private, no-store" } });
}
