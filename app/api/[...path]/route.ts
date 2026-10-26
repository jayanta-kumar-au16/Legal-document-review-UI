import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join("/");
  const allowed = /^(documents|playbooks|reviews)$/.test(route) ||
    /^documents\/[^/]+\/(text|clauses)$/.test(route) || /^playbooks\/[^/]+$/.test(route) ||
    /^reviews\/[^/]+(?:\/findings\/[^/]+)?$/.test(route);
  if (!allowed) return NextResponse.json({ message: "Unknown API route" }, { status: 404 });
  try {
    const base = (process.env.PYTHON_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const upstream = await fetch(`${base}/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`, {
      method: request.method, headers, cache: "no-store",
      body: request.method === "GET" ? undefined : await request.arrayBuffer(),
      signal: AbortSignal.timeout(300000),
    });
    return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    }});
  } catch {
    return NextResponse.json({ success: false, message: "Backend unavailable or timed out. Check PYTHON_API_BASE_URL and that FastAPI is running." }, { status: 502 });
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH };
