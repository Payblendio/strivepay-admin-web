import {NextRequest, NextResponse} from "next/server";
import {backend, responseBody} from "@/lib/backend";
import {hasValidRequestOrigin} from "@/lib/request-origin";
import {supportRouteAllowed, supportSocketUrl} from "@/lib/support-policy";
import {readSupportBody} from "@/lib/support-body";
import {cookies} from "next/headers";
import {ACCESS_COOKIE} from "@/lib/admin-access";

async function forward(request: NextRequest, context: {params: Promise<{path: string[]}>}) {
  const route = (await context.params).path.join("/");
  const fail = (title: string, status: number) => NextResponse.json({title, status}, {status, headers: {"Cache-Control": "no-store"}});
  if (!supportRouteAllowed(route, request.method, true)) return fail("Unsupported support operation", 404);
  if (request.method !== "GET" && (!request.headers.get("origin") || !hasValidRequestOrigin(request.headers.get("origin"), request.headers, request.nextUrl.origin))) {
    return fail("Invalid request origin", 403);
  }
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const headers: Record<string,string> | null = token ? {Authorization: `Bearer ${token}`, Accept: "application/json"} : null;
  if (!headers) return fail("Your session has expired", 401);
  let body: BodyInit | undefined;
  const upload=request.method==="POST"&&route.includes("/messages/")&&route.includes("/attachments/");
  if(upload){
    if(request.headers.get("content-type")!=="application/octet-stream")return fail("Send file bytes",415);
    const filename=request.headers.get("x-file-name");if(!filename||filename.length>1000)return fail("A file name is required",400);
    try{body=await readSupportBody(request,10*1024*1024);}catch{return fail("File exceeds 10 MB",413);}
    headers["Content-Type"]="application/octet-stream";headers["X-File-Name"]=filename;
  }else if (request.method !== "GET" && route !== "socket-ticket") {
    if (!request.headers.get("content-type")?.includes("application/json")) return fail("Send JSON data", 415);
    let text:string;try{text=new TextDecoder().decode(await readSupportBody(request,65536));}catch{return fail("This request is too large",413);}
    try { const value = JSON.parse(text); if (!value || typeof value !== "object" || Array.isArray(value)) return fail("Invalid support request", 400); body = JSON.stringify(value); }
    catch { return fail("Invalid support request", 400); }
    headers["Content-Type"] = "application/json";
  }
  const query = new URLSearchParams();
  for (const key of ["status", "page", "size", "after", "before", "q", "assignment"]) {
    const value = request.nextUrl.searchParams.get(key);
    if (value !== null) query.set(key, value);
  }
  try {
    // Socket tickets are POST-only and the browser Origin has been validated above.
    // Next's internal bind address is not necessarily reachable from the browser.
    const websocketUrl = route === "socket-ticket" ? supportSocketUrl(request.headers.get("origin")!, process.env.SUPPORT_WEBSOCKET_URL) : undefined;
    const upstream = await backend(`/v1/admin/support/${route}${query.size ? "?" + query : ""}`, {method: request.method, headers, body, signal: AbortSignal.timeout(15000)});
    if(upstream.ok&&request.method==="GET"&&/\/attachments\/[^/]+$/.test(route)){
      const bytes=await readSupportBody(upstream,10*1024*1024);
      const preview=request.nextUrl.searchParams.get("preview")==="1";
      return new NextResponse(bytes,{status:200,headers:{"Content-Type":upstream.headers.get("content-type")??"application/octet-stream","Content-Disposition":preview?"inline":(upstream.headers.get("content-disposition")??"attachment"),"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'"}});
    }
    const data = await responseBody(upstream);
    if (upstream.status === 204) return new NextResponse(null, {status: 204, headers: {"Cache-Control": "no-store"}});
    return NextResponse.json(websocketUrl && upstream.ok ? {...data, websocketUrl} : data ?? {}, {status: upstream.status, headers: {"Cache-Control": "no-store"}});
  } catch { return fail("Support is temporarily unavailable. Please try again.", 503); }
}
export const GET = forward;
export const POST = forward;
