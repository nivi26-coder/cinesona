import type { NextRequest } from "next/server";
import { isKind } from "@/lib/kinds";
import { isDbConfigured } from "@/lib/mongodb";
import { suggestTitles } from "@/lib/titles";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const kind = params.get("kind");
  if (q.length < 2 || q.length > 100) return Response.json({ suggestions: [] });
  if (!isDbConfigured()) return Response.json({ suggestions: [] }, { status: 503 });

  const suggestions = await suggestTitles(q, isKind(kind) ? kind : undefined);
  return Response.json(
    { suggestions },
    // Titles only change when an import runs, so let the browser reuse answers for a minute.
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
