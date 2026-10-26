import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const base = process.env.PYTHON_API_BASE_URL || "http://localhost:8000";
  try {
    const body = await request.json();
    // Python service contract: POST /api/reviews with { document_id, playbook_id }.
    const upstream = await fetch(`${base}/api/reviews`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store"
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Could not connect to the Python API. Start the Python service and verify PYTHON_API_BASE_URL." }, { status: 502 });
  }
}