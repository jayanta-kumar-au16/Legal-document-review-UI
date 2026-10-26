import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const format = request.nextUrl.searchParams.get("format") || "json";
  const base = process.env.PYTHON_API_BASE_URL || "http://localhost:8000";
  try {
    const upstream = await fetch(`${base}/api/reviews/${encodeURIComponent(id)}/export?format=${encodeURIComponent(format)}`, { cache: "no-store" });
    const data = await upstream.arrayBuffer();
    return new NextResponse(data, { status: upstream.status, headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Content-Disposition": upstream.headers.get("content-disposition") || `attachment; filename="${id}-review.json"`
    }});
  } catch {
    return NextResponse.json({ error: "Python export service is unavailable." }, { status: 502 });
  }
}