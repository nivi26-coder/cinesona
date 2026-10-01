import type { NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/mongodb";
import { suggestTitles } from "@/lib/movies";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 100) return Response.json({ suggestions: [] });
  if (!isDbConfigured()) return Response.json({ suggestions: [] }, { status: 503 });

  const suggestions = await suggestTitles(q);
  return Response.json(
    { suggestions },
    // Titles don't change, so let the browser reuse answers for a minute.
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
