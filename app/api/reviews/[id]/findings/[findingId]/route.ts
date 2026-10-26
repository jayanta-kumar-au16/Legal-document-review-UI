import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; findingId: string }> }) {
  const { id, findingId } = await context.params;
  const base = process.env.PYTHON_API_BASE_URL || "http://localhost:8000";
  try {
    const body = await request.json();
    const upstream = await fetch(`${base}/api/reviews/${encodeURIComponent(id)}/findings/${encodeURIComponent(findingId)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store"
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Could not persist the reviewer decision because the Python API is unavailable." }, { status: 502 });
  }
}