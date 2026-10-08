import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { backend, responseBody } from "@/lib/backend";
import { ACCESS_COOKIE } from "@/lib/admin-access";
import { hasValidRequestOrigin } from "@/lib/request-origin";

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const ROUTES: Array<{ pattern: RegExp; methods: Set<string> }> = [
  { pattern: /^overview$/, methods: new Set(["GET"]) },
  { pattern: /^exchange-rates$/, methods: new Set(["GET", "PUT"]) },
  { pattern: /^exchange-rates\/majors$/, methods: new Set(["GET"]) },
  { pattern: /^exchange-rates\/daily-majors$/, methods: new Set(["POST"]) },
  { pattern: /^fees$/, methods: new Set(["GET", "PUT"]) },
  { pattern: new RegExp(`^fees/${UUID}$`), methods: new Set(["GET", "DELETE"]) },
  { pattern: /^fees\/report$/, methods: new Set(["GET"]) },
  { pattern: /^fees\/ngn-markup$/, methods: new Set(["GET", "PUT"]) },
  { pattern: /^fees\/provider$/, methods: new Set(["GET"]) },
  { pattern: /^fees\/simulator\/purge$/, methods: new Set(["POST"]) },
  { pattern: /^fees\/synchronizations$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^fees/synchronizations/${UUID}$`), methods: new Set(["GET"]) },
  { pattern: new RegExp(`^fees/synchronizations/${UUID}/retry$`), methods: new Set(["POST"]) },
  { pattern: /^compliance\/legal-documents$/, methods: new Set(["GET", "POST"]) },
  { pattern: /^notifications\/deliveries$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^notifications/deliveries/${UUID}/retry$`), methods: new Set(["POST"]) },
  { pattern: /^business-webhooks\/deliveries$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^business-webhooks/deliveries/${UUID}/retry$`), methods: new Set(["POST"]) },
  { pattern: new RegExp(`^rbac/roles/${UUID}$`), methods: new Set(["PUT"]) },
  { pattern: /^customers$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^customers/${UUID}$`), methods: new Set(["GET"]) },
  { pattern: new RegExp(`^customers/${UUID}/members$`), methods: new Set(["GET"]) },
  { pattern: /^search$/, methods: new Set(["GET"]) },
  { pattern: /^account-deletions$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^account-deletions/${UUID}/complete$`), methods: new Set(["POST"]) },
  { pattern: /^data-deletions$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^data-deletions/${UUID}/(complete|reject)$`), methods: new Set(["POST"]) },
  { pattern: /^pay-in-accounts$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^pay-in-accounts/${UUID}$`), methods: new Set(["GET"]) },
  { pattern: new RegExp(`^pay-in-accounts/${UUID}/transactions$`), methods: new Set(["GET"]) },
  { pattern: /^destination-accounts$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^destination-accounts/${UUID}$`), methods: new Set(["GET"]) },
  { pattern: new RegExp(`^destination-accounts/${UUID}/transactions$`), methods: new Set(["GET"]) },
  { pattern: /^transactions$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^transactions/${UUID}$`), methods: new Set(["GET"]) },
  { pattern: new RegExp(`^transactions/${UUID}/ledger$`), methods: new Set(["GET"]) },
  { pattern: new RegExp(`^transactions/${UUID}/economics$`), methods: new Set(["GET"]) },
  { pattern: new RegExp(`^transactions/${UUID}/resume-liquidity$`), methods: new Set(["POST"]) },
  { pattern: new RegExp(`^transactions/${UUID}/reopen-review$`), methods: new Set(["POST"]) },
  { pattern: new RegExp(`^transactions/${UUID}/costs/${UUID}/valuation$`), methods: new Set(["PUT"]) },
  { pattern: new RegExp(`^transactions/${UUID}/costs/${UUID}/actual$`), methods: new Set(["PUT"]) },
  { pattern: /^runtime\/worker$/, methods: new Set(["GET"]) },
  { pattern: /^runtime\/operational-readiness$/, methods: new Set(["GET"]) },
  { pattern: /^runtime\/error-budgets$/, methods: new Set(["GET"]) },
  { pattern: /^runtime\/operational-alerts$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^runtime/operational-alerts/${UUID}/acknowledge$`), methods: new Set(["POST"]) },
  { pattern: /^webhooks$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^webhooks/${UUID}$`), methods: new Set(["GET"]) },
  { pattern: new RegExp(`^webhooks/${UUID}/retry$`), methods: new Set(["POST"]) },
  { pattern: new RegExp(`^webhooks/${UUID}/ignore$`), methods: new Set(["POST"]) },
  { pattern: /^coverage\/settlement\/sync$/, methods: new Set(["POST"]) },
  { pattern: /^coverage\/quidax\/sync$/, methods: new Set(["POST"]) },
  { pattern: /^assets$/, methods: new Set(["GET"]) },
  { pattern: /^assets\/[A-Z0-9_]+$/, methods: new Set(["PUT"]) },
  { pattern: /^networks$/, methods: new Set(["GET"]) },
  { pattern: /^networks\/[A-Z0-9_]+$/, methods: new Set(["PUT"]) },
  { pattern: /^corridors$/, methods: new Set(["GET", "PUT"]) },
  { pattern: new RegExp(`^corridors/${UUID}$`), methods: new Set(["GET"]) },
  { pattern: new RegExp(`^corridors/${UUID}/certification$`), methods: new Set(["PUT"]) },
  { pattern: /^reconciliation$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^reconciliation/${UUID}$`), methods: new Set(["GET"]) },
  { pattern: /^audit-events$/, methods: new Set(["GET"]) },
  { pattern: /^api-request-logs$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^api-request-logs/${UUID}$`), methods: new Set(["GET"]) },
  { pattern: /^treasury\/tasks$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^treasury/tasks/${UUID}$`), methods: new Set(["GET"]) },
  { pattern: new RegExp(`^treasury/tasks/${UUID}/evidence$`), methods: new Set(["POST"]) },
  { pattern: /^treasury\/ngn-masters\/config$/, methods: new Set(["GET"]) },
  { pattern: /^treasury\/ngn-masters$/, methods: new Set(["GET", "POST"]) },
  { pattern: /^treasury\/ngn-masters\/provider-accounts$/, methods: new Set(["GET"]) },
  { pattern: /^treasury\/ngn-masters\/import$/, methods: new Set(["POST"]) },
  { pattern: new RegExp(`^treasury/ngn-masters/${UUID}/default-sweep$`), methods: new Set(["POST"]) },
  { pattern: new RegExp(`^treasury/ngn-masters/${UUID}/default-payout$`), methods: new Set(["POST"]) },
  { pattern: new RegExp(`^treasury/ngn-masters/${UUID}/disable$`), methods: new Set(["POST"]) },
  { pattern: new RegExp(`^treasury/ngn-masters/${UUID}/refresh-balance$`), methods: new Set(["POST"]) },
  { pattern: /^automatic-conversion-alerts$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^automatic-conversion-alerts/${UUID}$`), methods: new Set(["GET"]) },
  { pattern: new RegExp(`^automatic-conversion-alerts/${UUID}/acknowledge$`), methods: new Set(["POST"]) },
  { pattern: new RegExp(`^automatic-conversions/${UUID}/costs$`), methods: new Set(["GET"]) },
  { pattern: new RegExp(`^automatic-conversions/${UUID}/costs/${UUID}/valuation$`), methods: new Set(["PUT"]) },
  { pattern: /^rbac\/admins$/, methods: new Set(["GET", "POST"]) },
  { pattern: new RegExp(`^rbac/admins/${UUID}/roles$`), methods: new Set(["PUT"]) },
  { pattern: new RegExp(`^rbac/admins/${UUID}/status$`), methods: new Set(["PUT"]) },
  { pattern: /^rbac\/roles$/, methods: new Set(["GET", "POST"]) },
  { pattern: /^provider\/webhook-endpoints$/, methods: new Set(["GET", "POST"]) },
  { pattern: /^provider\/webhook-endpoints\/[^/]+$/, methods: new Set(["GET", "PATCH", "DELETE"]) },
  { pattern: /^provider\/webhook-endpoints\/[^/]+\/secret$/, methods: new Set(["PATCH"]) },
  { pattern: /^provider\/webhook-endpoints\/[^/]+\/test$/, methods: new Set(["POST"]) },
  { pattern: /^provider\/sandbox\/environment$/, methods: new Set(["GET"]) },
  { pattern: /^provider\/sandbox\/targets$/, methods: new Set(["GET"]) },
  { pattern: new RegExp(`^provider/sandbox/targets/${UUID}/accounts$`), methods: new Set(["GET"]) },
  { pattern: /^provider\/quidax\/environment$/, methods: new Set(["GET"]) },
  { pattern: /^provider\/quidax\/parent$/, methods: new Set(["GET"]) },
  { pattern: /^provider\/quidax\/parent\/wallets$/, methods: new Set(["GET"]) },
  { pattern: /^provider\/quidax\/parent\/wallets\/sync$/, methods: new Set(["POST"]) },
  { pattern: /^provider\/quidax\/parent\/wallets\/[A-Za-z0-9_-]+$/, methods: new Set(["GET"]) },
  { pattern: /^provider\/quidax\/parent\/wallets\/[A-Za-z0-9_-]+\/addresses$/, methods: new Set(["GET"]) },
  { pattern: /^provider\/quidax\/accounts$/, methods: new Set(["GET"]) },
  // Quidax user ids are usually UUIDs but sandbox can return short alphanumeric ids.
  { pattern: /^provider\/quidax\/accounts\/[A-Za-z0-9_-]+$/, methods: new Set(["GET"]) },
  { pattern: /^provider\/quidax\/accounts\/[A-Za-z0-9_-]+\/wallets$/, methods: new Set(["GET"]) },
  { pattern: /^provider\/quidax\/accounts\/[A-Za-z0-9_-]+\/wallets\/[A-Za-z0-9_-]+$/, methods: new Set(["GET"]) },
  { pattern: /^provider\/quidax\/accounts\/[A-Za-z0-9_-]+\/wallets\/[A-Za-z0-9_-]+\/addresses$/, methods: new Set(["GET"]) },
  { pattern: /^provider\/quidax\/parent\/swap\/preview$/, methods: new Set(["POST"]) },
  { pattern: /^provider\/quidax\/parent\/swap\/quote$/, methods: new Set(["POST"]) },
  { pattern: /^provider\/quidax\/parent\/swap\/confirm$/, methods: new Set(["POST"]) },
  { pattern: new RegExp(`^provider/sandbox/targets/${UUID}/(kyc|kyb)$`), methods: new Set(["PATCH"]) },
  { pattern: new RegExp(`^provider/sandbox/targets/${UUID}/(fiat|crypto)$`), methods: new Set(["POST"]) },
];

function allowed(route: string, method: string) {
  return ROUTES.some((entry) => entry.pattern.test(route) && entry.methods.has(method));
}

async function forward(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const route = ((await context.params).path ?? []).join("/");
  if (!allowed(route, request.method)) {
    return NextResponse.json({ title: "Unsupported admin operation" }, { status: 404 });
  }
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (!hasValidRequestOrigin(origin, request.headers, request.nextUrl.origin)) {
      return NextResponse.json({ title: "Invalid request origin" }, { status: 403 });
    }
  }

  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ type: "authentication_failed", title: "Authentication failed", status: 401 }, { status: 401 });
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  let body: string | undefined;
  if (request.method !== "GET") {
    const payload = await request.json().catch(() => null);
    if (payload !== null) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(payload);
    }
  }

  const search = request.nextUrl.search;
  const upstream = await backend(`/v1/admin/${route}${search}`, { method: request.method, headers, body });
  const data = await responseBody(upstream);
  if (upstream.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(data ?? {}, { status: upstream.status });
}

export const GET = forward;
export const PUT = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
