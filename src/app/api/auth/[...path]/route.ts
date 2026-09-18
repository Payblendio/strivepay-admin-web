import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { backend, responseBody } from "@/lib/backend";
import { ACCESS_COOKIE } from "@/lib/admin-access";
import { hasValidRequestOrigin } from "@/lib/request-origin";

const PUBLIC_POST = new Set(["login"]);
const PROTECTED_POST = new Set(["logout"]);

function sessionCookie(response: NextResponse, token: string, expiresAt: string) {
  response.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

function clearSession(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { expires: new Date(0), path: "/" });
}

function bearerHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function jsonOrEmpty(request: NextRequest) {
  return request.json().catch(() => ({}));
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const route = (await context.params).path.join("/");
  if (route !== "me" && route !== "sessions") {
    return NextResponse.json({ title: "Unsupported authentication operation" }, { status: 404 });
  }
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ type: "authentication_failed", title: "Authentication failed", status: 401 }, { status: 401 });
  }
  const upstream = await backend(`/v1/admin/auth/${route}`, { headers: bearerHeaders(token) });
  const data = await responseBody(upstream);
  if (upstream.status === 401) {
    const response = NextResponse.json(data ?? { type: "authentication_failed", title: "Authentication failed", status: 401 }, { status: 401 });
    clearSession(response);
    return response;
  }
  return NextResponse.json(data ?? {}, { status: upstream.status });
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const segments = (await context.params).path;
  const route = segments.join("/");
  const revoke = route.match(/^sessions\/([^/]+)\/revoke$/);
  if (!PUBLIC_POST.has(route) && !PROTECTED_POST.has(route) && !revoke) {
    return NextResponse.json({ title: "Unsupported authentication operation" }, { status: 404 });
  }

  if (route !== "login" && request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (!hasValidRequestOrigin(origin, request.headers, request.nextUrl.origin)) {
      return NextResponse.json({ title: "Invalid request origin" }, { status: 403 });
    }
  }

  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  const payload = await jsonOrEmpty(request);

  if (route === "login") {
    const upstream = await backend("/v1/admin/auth/login", {
      method: "POST",
      headers: { ...bearerHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await responseBody(upstream) as Record<string, unknown> | null;
    if (!upstream.ok) {
      return NextResponse.json(data ?? {}, { status: upstream.status });
    }
    const accessToken = typeof data?.accessToken === "string" ? data.accessToken : "";
    const expiresAt = typeof data?.expiresAt === "string" ? data.expiresAt : "";
    const sessionId = data?.sessionId;
    if (!accessToken || !expiresAt) {
      return NextResponse.json({ title: "The service returned an unreadable response" }, { status: 502 });
    }
    const response = NextResponse.json({ authenticated: true, expiresAt, sessionId }, { status: 200 });
    sessionCookie(response, accessToken, expiresAt);
    return response;
  }

  if (!token) {
    return NextResponse.json({ type: "authentication_failed", title: "Authentication failed", status: 401 }, { status: 401 });
  }

  const target = revoke ? `/v1/admin/auth/sessions/${revoke[1]}/revoke` : `/v1/admin/auth/${route}`;
  const upstream = await backend(target, {
    method: "POST",
    headers: { ...bearerHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await responseBody(upstream);
  const response = upstream.status === 204
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json(data ?? {}, { status: upstream.status });
  if (route === "logout" && (upstream.ok || upstream.status === 401)) clearSession(response);
  if (upstream.status === 401) clearSession(response);
  return response;
}
