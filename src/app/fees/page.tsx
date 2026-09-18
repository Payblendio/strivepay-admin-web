import type { Metadata } from "next";
import Link from "next/link";
import { FeeDisableButton, FeeRetryButton, FeesDeskActions } from "@/components/fees-desk-actions";
import { OpsShell } from "@/components/ops-shell";
import { PageNav } from "@/components/page-nav";
import { ViewLink } from "@/components/view-link";
import { PublishMajorRatesButton } from "@/components/publish-major-rates-button";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { loadList } from "@/lib/admin-load";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { slicePage } from "@/lib/paginate";
import { asRecord, assetOrAny, formatAmount, formatInstant, formatPercentRate, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Fees & FX" };

type Tab = "bakkt" | "ngn" | "fx" | "sync";
type Search = Promise<{
  tab?: string | string[];
  scope?: string | string[];
  feesPage?: string | string[];
  ratesPage?: string | string[];
  syncPage?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isNgnRule(row: Record<string, unknown>) {
  const source = text(row, "source_asset", "sourceAsset");
  const destination = text(row, "destination_asset", "destinationAsset");
  return source === "NGN" || destination === "NGN";
}

/** Keep Bakkt desk focused: live/provider rules only (hide simulator LOCAL_ONLY clutter). */
function isDeskVisible(row: Record<string, unknown>) {
  const sync = text(row, "sync_status", "syncStatus").toUpperCase();
  if (sync === "LOCAL_ONLY") return false;
  const active = row.active === true || row.active === "true";
  if (active) return true;
  return sync === "PENDING" || sync === "FAILED" || sync === "DEAD";
}

function parseTab(raw: string): Tab {
  if (raw === "ngn" || raw === "fx" || raw === "sync") return raw;
  return "bakkt";
}

export default async function FeesPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const tab = parseTab(first(params.tab));
  const feesPage = Math.max(0, Number(first(params.feesPage) || 0) || 0);
  const ratesPage = Math.max(0, Number(first(params.ratesPage) || 0) || 0);
  const syncPage = Math.max(0, Number(first(params.syncPage) || 0) || 0);
  const scopeFilter = (first(params.scope) || "GLOBAL").toUpperCase() === "PARTY" ? "PARTY" : "GLOBAL";
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.feesView, "/fees");
  const canManage = hasPermission(principal.permissions, PERMISSIONS.feesManage);

  const [feesResponse, ratesResponse, majorsResponse, syncResponse, markupResponse, providerResponse] = await Promise.all([
    adminBackend(token, "/v1/admin/fees"),
    adminBackend(token, "/v1/admin/exchange-rates"),
    adminBackend(token, "/v1/admin/exchange-rates/majors?reportingCurrency=USD"),
    adminBackend(token, "/v1/admin/fees/synchronizations"),
    adminBackend(token, "/v1/admin/fees/ngn-markup"),
    tab === "sync" ? adminBackend(token, "/v1/admin/fees/provider") : Promise.resolve(null),
  ]);

  const feesLoad = await loadList(feesResponse);
  const ratesLoad = await loadList(ratesResponse);
  const majorsLoad = await loadList(majorsResponse);
  const syncLoad = await loadList(syncResponse);

  let ngnMarkup: Record<string, unknown> | null = null;
  let ngnMarkupError = "";
  if (markupResponse.ok) {
    ngnMarkup = asRecord(await responseBody(markupResponse));
  } else {
    const payload = asRecord(await responseBody(markupResponse).catch(() => null));
    ngnMarkupError = text(payload, "title") !== "—" ? text(payload, "title") : "NGN markup unavailable";
  }

  let providerSnapshot: unknown = null;
  let providerError = "";
  if (providerResponse) {
    if (providerResponse.ok) {
      providerSnapshot = await responseBody(providerResponse);
    } else {
      const payload = asRecord(await responseBody(providerResponse).catch(() => null));
      providerError = text(payload, "title") !== "—" ? text(payload, "title") : "Bakkt snapshot unavailable";
    }
  }

  const bakktFees = feesLoad.rows.filter((row) => !isNgnRule(row) && isDeskVisible(row));
  const scopedFees = bakktFees.filter((row) => text(row, "scope_type", "scopeType") === scopeFilter);
  const feesPaged = slicePage(scopedFees, feesPage, size);
  const ratesPaged = slicePage(ratesLoad.rows, ratesPage, size);
  const syncPaged = slicePage(syncLoad.rows, syncPage, size);
  const markupPct = formatPercentRate(ngnMarkup?.markupPercent ?? ngnMarkup?.markup_percent);
  const failedSync = syncLoad.rows.filter((row) => {
    const status = text(row, "status").toUpperCase();
    return status === "FAILED" || status === "DEAD" || status === "PENDING";
  }).length;

  function href(next: { tab?: Tab; scope?: "GLOBAL" | "PARTY"; feesPage?: number; ratesPage?: number; syncPage?: number }) {
    const paramsNext = new URLSearchParams();
    const nextTab = next.tab ?? tab;
    if (nextTab !== "bakkt") paramsNext.set("tab", nextTab);
    const nextScope = next.scope ?? scopeFilter;
    if (nextTab === "bakkt" && nextScope === "PARTY") paramsNext.set("scope", "PARTY");
    const fp = next.feesPage ?? (nextTab === "bakkt" ? feesPage : 0);
    const rp = next.ratesPage ?? (nextTab === "fx" ? ratesPage : 0);
    const sp = next.syncPage ?? (nextTab === "sync" ? syncPage : 0);
    if (fp > 0) paramsNext.set("feesPage", String(fp));
    if (rp > 0) paramsNext.set("ratesPage", String(rp));
    if (sp > 0) paramsNext.set("syncPage", String(sp));
    const search = paramsNext.toString();
    return search ? `/fees?${search}` : "/fees";
  }

  const tabs: Array<{ id: Tab; label: string; badge?: string }> = [
    { id: "bakkt", label: "Bakkt" },
    { id: "ngn", label: "NGN", badge: markupPct !== "—" ? markupPct : undefined },
    { id: "fx", label: "FX" },
    { id: "sync", label: "Sync", badge: failedSync ? String(failedSync) : undefined },
  ];

  return (
    <OpsShell
      principal={principal}
      eyebrow="Pricing"
      title="Fees"
      copy="Merchant fees push to Bakkt on save. NGN uses Quidax markup."
    >
      <nav className="fees-tabs" aria-label="Fees sections">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={href({ tab: item.id, feesPage: 0, ratesPage: 0, syncPage: 0 })}
            className={`fees-tab${tab === item.id ? " is-active" : ""}`}
          >
            {item.label}
            {item.badge ? <span className="fees-tab-badge">{item.badge}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "bakkt" ? (
        <section className="ops-panel">
          <div className="ops-panel-heading">
            <div>
              <span>Bakkt</span>
              <h2>{scopeFilter === "PARTY" ? "Party overrides" : "Merchant defaults"}</h2>
            </div>
            <div className="reason-actions">
              <Link className={`ops-link${scopeFilter === "GLOBAL" ? " is-strong" : ""}`} href={href({ scope: "GLOBAL", feesPage: 0 })}>Merchant</Link>
              <Link className={`ops-link${scopeFilter === "PARTY" ? " is-strong" : ""}`} href={href({ scope: "PARTY", feesPage: 0 })}>Party</Link>
              {canManage ? (
                <FeesDeskActions
                  canManage={canManage}
                  tab={tab}
                  ngnMarkup={null}
                />
              ) : null}
            </div>
          </div>
          {!feesLoad.ok ? (
            <EmptyState compact title="Fee rules unavailable" description={feesLoad.error} />
          ) : (
            <>
              <PageNav page={feesPaged.page} size={feesPaged.size} total={feesPaged.total} hrefFor={(page) => href({ feesPage: page })} />
              <DataTable
                columns={[
                  {
                    key: "corridor",
                    header: "Corridor",
                    render: (row) => `${assetOrAny(row.source_asset ?? row.sourceAsset)} → ${assetOrAny(row.destination_asset ?? row.destinationAsset)}`,
                  },
                  {
                    key: "direction",
                    header: "Bakkt",
                    render: (row) => text(row, "bakkt_direction", "bakktDirection") !== "—"
                      ? text(row, "bakkt_direction", "bakktDirection")
                      : text(row, "direction"),
                  },
                  {
                    key: "method",
                    header: "Method",
                    render: (row) => {
                      const method = text(row, "payment_method", "paymentMethod");
                      return method === "—" ? "Any" : method;
                    },
                  },
                  { key: "percent", header: "%", render: (row) => formatPercentRate(row.percentage_rate ?? row.percentageRate) },
                  {
                    key: "min",
                    header: "Min",
                    render: (row) => formatAmount(row.minimum_amount ?? row.minimumAmount, row.fee_asset ?? row.feeAsset),
                  },
                  {
                    key: "op",
                    header: "Op",
                    render: (row) => text(row, "fee_op_type", "feeOpType") === "—" ? "add" : text(row, "fee_op_type", "feeOpType"),
                  },
                  {
                    key: "sync",
                    header: "Sync",
                    render: (row) => <Badge tone={toneForStatus(text(row, "sync_status", "syncStatus"))}>{text(row, "sync_status", "syncStatus")}</Badge>,
                  },
                  {
                    key: "actions",
                    header: "",
                    render: (row) => {
                      const id = text(row, "id");
                      const active = row.active === true || row.active === "true";
                      const label = `${text(row, "bakkt_direction", "bakktDirection")} ${text(row, "source_asset", "sourceAsset")}`;
                      return (
                        <div className="reason-actions">
                          {canManage && active ? <FeeDisableButton id={id} label={label} /> : null}
                          <ViewLink href={`/fees/${id}`} />
                        </div>
                      );
                    },
                  },
                ]}
                rows={feesPaged.rows}
                getKey={(row) => text(row, "id")}
                empty={<EmptyState compact title="No Bakkt fees" description="Add a merchant ONRAMP or OFFRAMP fee." />}
              />
            </>
          )}
        </section>
      ) : null}

      {tab === "ngn" ? (
        <section className="ops-panel">
          <div className="ops-panel-heading">
            <div>
              <span>Quidax</span>
              <h2>NGN rate markup</h2>
            </div>
            {canManage ? (
              <FeesDeskActions
                canManage={canManage}
                tab={tab}
                ngnMarkup={ngnMarkup ? {
                  markupPercent: String(ngnMarkup.markupPercent ?? ngnMarkup.markup_percent ?? ""),
                  updatedAt: String(ngnMarkup.updatedAt ?? ngnMarkup.updated_at ?? ""),
                } : null}
              />
            ) : null}
          </div>
          {ngnMarkupError ? (
            <EmptyState compact title="NGN markup unavailable" description={ngnMarkupError} />
          ) : (
            <dl className="ops-facts fees-facts">
              <div>
                <dt>Markup</dt>
                <dd>{markupPct}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatInstant(ngnMarkup?.updatedAt ?? ngnMarkup?.updated_at)}</dd>
              </div>
            </dl>
          )}
        </section>
      ) : null}

      {tab === "fx" ? (
        <>
          <section className="ops-panel">
            <div className="ops-panel-heading">
              <div>
                <span>FX</span>
                <h2>Major board</h2>
              </div>
              <div className="reason-actions">
                {canManage ? <PublishMajorRatesButton /> : null}
                {canManage ? <FeesDeskActions canManage={canManage} tab={tab} ngnMarkup={null} /> : null}
              </div>
            </div>
            {!majorsLoad.ok ? (
              <EmptyState compact title="Major rates unavailable" description={majorsLoad.error} />
            ) : (
              <DataTable
                columns={[
                  {
                    key: "pair",
                    header: "Pair",
                    render: (row) => `${text(row, "base_currency", "baseCurrency")} / ${text(row, "quote_currency", "quoteCurrency")}`,
                  },
                  { key: "rate", header: "Rate", render: (row) => text(row, "rate") },
                  { key: "source", header: "Source", render: (row) => text(row, "source") },
                  {
                    key: "freshness",
                    header: "Freshness",
                    render: (row) => <Badge tone={toneForStatus(text(row, "freshness"))}>{text(row, "freshness")}</Badge>,
                  },
                  { key: "observed", header: "Observed", render: (row) => formatInstant(row.observed_at ?? row.observedAt) },
                ]}
                rows={majorsLoad.rows}
                getKey={(row) => `${text(row, "base_currency", "baseCurrency")}-${text(row, "quote_currency", "quoteCurrency")}`}
                empty={<EmptyState compact title="No major rates" description="Publish daily majors to populate the board." />}
              />
            )}
          </section>
          <section className="ops-panel">
            <h2>Published rates</h2>
            {!ratesLoad.ok ? (
              <EmptyState compact title="Published rates unavailable" description={ratesLoad.error} />
            ) : (
              <>
                <PageNav page={ratesPaged.page} size={ratesPaged.size} total={ratesPaged.total} hrefFor={(page) => href({ ratesPage: page })} />
                <DataTable
                  columns={[
                    {
                      key: "pair",
                      header: "Pair",
                      render: (row) => `${text(row, "base_currency", "baseCurrency")} / ${text(row, "quote_currency", "quoteCurrency")}`,
                    },
                    { key: "rate", header: "Rate", render: (row) => text(row, "rate") },
                    { key: "source", header: "Source", render: (row) => text(row, "source") },
                    { key: "observed", header: "Observed", render: (row) => formatInstant(row.observed_at ?? row.observedAt) },
                  ]}
                  rows={ratesPaged.rows}
                  getKey={(row) => `${text(row, "base_currency", "baseCurrency")}-${text(row, "quote_currency", "quoteCurrency")}-${text(row, "source")}`}
                  empty={<EmptyState compact title="No published rates" description="Publish a rate to populate this table." />}
                />
              </>
            )}
          </section>
        </>
      ) : null}

      {tab === "sync" ? (
        <section className="ops-panel">
          <div className="ops-panel-heading">
            <div>
              <span>Health</span>
              <h2>Fee synchronizations</h2>
            </div>
            {canManage ? <FeesDeskActions canManage={canManage} tab={tab} ngnMarkup={null} /> : null}
          </div>
          {!syncLoad.ok ? (
            <EmptyState compact title="Sync jobs unavailable" description={syncLoad.error} />
          ) : (
            <>
              <PageNav page={syncPaged.page} size={syncPaged.size} total={syncPaged.total} hrefFor={(page) => href({ syncPage: page })} />
              <DataTable
                columns={[
                  {
                    key: "id",
                    header: "Job",
                    render: (row) => <Link className="ops-link" href={`/fees/synchronizations/${text(row, "id")}`}>{text(row, "id").slice(0, 8)}…</Link>,
                  },
                  {
                    key: "rule",
                    header: "Fee rule",
                    render: (row) => {
                      const ruleId = text(row, "fee_rule_id", "feeRuleId");
                      return ruleId === "—" ? "—" : <Link className="ops-link" href={`/fees/${ruleId}`}>{ruleId.slice(0, 8)}…</Link>;
                    },
                  },
                  { key: "action", header: "Action", render: (row) => text(row, "action") },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge>,
                  },
                  { key: "error", header: "Last error", render: (row) => text(row, "last_error", "lastError") },
                  { key: "created", header: "Created", render: (row) => formatInstant(row.created_at ?? row.createdAt) },
                  {
                    key: "actions",
                    header: "",
                    render: (row) => {
                      const status = text(row, "status").toUpperCase();
                      const id = text(row, "id");
                      return (
                        <div className="reason-actions">
                          {canManage && (status === "FAILED" || status === "DEAD") ? <FeeRetryButton id={id} /> : null}
                          <ViewLink href={`/fees/synchronizations/${id}`} />
                        </div>
                      );
                    },
                  },
                ]}
                rows={syncPaged.rows}
                getKey={(row) => text(row, "id")}
                empty={<EmptyState compact title="No sync jobs" description="Bakkt fee PATCHes appear here after save." />}
              />
            </>
          )}
          {providerError ? (
            <small className="ops-inline-note">Live Bakkt: {providerError}</small>
          ) : providerSnapshot ? (
            <details className="fees-provider-details">
              <summary>Live Bakkt merchant fees</summary>
              <pre className="ops-code-block">{JSON.stringify(providerSnapshot, null, 2)}</pre>
            </details>
          ) : null}
        </section>
      ) : null}
    </OpsShell>
  );
}
