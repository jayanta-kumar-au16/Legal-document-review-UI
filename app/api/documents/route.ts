import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const base = process.env.PYTHON_API_BASE_URL || "http://localhost:8000";
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    const upstreamForm = new FormData();
    upstreamForm.append("file", file, file.name);
    // Python service contract: POST /api/documents, multipart field "file".
    const upstream = await fetch(`${base}/api/documents`, { method: "POST", body: upstreamForm, cache: "no-store" });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Could not connect to the Python API. Start the Python service and verify PYTHON_API_BASE_URL." }, { status: 502 });
  }
}