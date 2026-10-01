import { NextResponse } from "next/server";
import { backend, responseBody } from "@/lib/backend";

export async function GET() {
  const upstream = await backend("/v1/assets");
  const data = await responseBody(upstream);
  return NextResponse.json(Array.isArray(data) ? data : [], {
    status: upstream.ok ? 200 : upstream.status,
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
