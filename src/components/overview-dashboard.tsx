import Link from "next/link";
import { CurrencyPairClip } from "@/components/currency-pair-clip";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { PublishMajorRatesButton } from "@/components/publish-major-rates-button";
import type { AdminOverview, OverviewChartDay } from "@/lib/admin-types";
import { asNumber, asString, formatAmount, formatInstant, toneForStatus } from "@/lib/values";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CHART_WIDTH = 720;
const CHART_LEFT = 42;
const CHART_RIGHT = 700;
const CHART_TOP = 18;
const CHART_BOTTOM = 210;

function money(value: number | string | null | undefined, currency: string) {
  const amount = asNumber(value);
  if (amount == null) return "—";
  return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function rateLabel(value: number | string | null | undefined) {
  const amount = asNumber(value);
  if (amount == null) return "—";
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function dayLabel(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return day;
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function buildChart(days: OverviewChartDay[]) {
  const maximum = Math.max(1, ...days.map((day) => day.total));
  const points = days.map((day, index) => {
    const x = CHART_LEFT + (days.length <= 1 ? 0 : (index / (days.length - 1)) * (CHART_RIGHT - CHART_LEFT));
    const y = CHART_BOTTOM - (day.total / maximum) * (CHART_BOTTOM - CHART_TOP);
    return { ...day, x, y };
  });
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = points.length
    ? `${line} L${points[points.length - 1].x},${CHART_BOTTOM} L${points[0].x},${CHART_BOTTOM} Z`
    : "";
  return { maximum, points, line, area, periodCount: days.reduce((sum, day) => sum + day.total, 0) };
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ready" | "not-ready" | "accent";
}) {
  return (
    <article className={`ops-stat-card${tone ? ` ${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

export function OverviewDashboard({
  overview,
  canPublishRates,
}: {
  overview: AdminOverview;
  canPublishRates: boolean;
}) {
  const currency = overview.reportingCurrency;
  const chart = buildChart(overview.transactionChart ?? []);
  const today = overview.feesToday;
  const month = overview.feesMonthToDate;
  const readiness = overview.readiness;
  const buyCount = overview.transactionChart.reduce((sum, day) => sum + day.buy, 0);
  const sellCount = overview.transactionChart.reduce((sum, day) => sum + day.sell, 0);

  return (
    <div className="ops-overview">
      <section className="ops-stat-grid" aria-label="Fee and volume summary">
        <StatCard
          label="Fees today"
          value={money(today.feeRevenue, currency)}
          hint={`${today.transactions} settled fee${today.transactions === 1 ? "" : "s"} · avg ${money(today.estimatedAverageFee, currency)}`}
          tone="accent"
        />
        <StatCard
          label="Fees MTD"
          value={money(month.feeRevenue, currency)}
          hint={`${month.transactions} settled · ${month.valuationStatus.replaceAll("_", " ").toLowerCase()}`}
        />
        <StatCard
          label="Est. profit MTD"
          value={month.realizedProfit == null ? "Pending valuation" : money(month.realizedProfit, currency)}
          hint={month.unvaluedCosts > 0 ? `${month.unvaluedCosts} cost line${month.unvaluedCosts === 1 ? "" : "s"} unvalued` : "All costs valued"}
          tone={month.realizedProfit == null ? "not-ready" : "ready"}
        />
        <StatCard
          label="Provider costs MTD"
          value={money(month.providerCosts, currency)}
          hint={`Book size ${overview.totalTransactions.toLocaleString("en-US")} txs`}
        />
        <StatCard
          label="Platform"
          value={readiness.status.replaceAll("_", " ")}
          hint={`${readiness.totalCriticalItems} critical item${readiness.totalCriticalItems === 1 ? "" : "s"}`}
          tone={readiness.status === "READY" ? "ready" : "not-ready"}
        />
        <StatCard
          label="FX board"
          value={overview.majorRatesStale ? "Needs refresh" : "Fresh"}
          hint={`${overview.majorRates.length} major pairs vs ${currency}`}
          tone={overview.majorRatesStale ? "not-ready" : "ready"}
        />
      </section>

      <div className="ops-overview-split">
        <section className="ops-panel ops-chart-panel" aria-labelledby="ops-tx-chart-title">
          <header className="ops-panel-heading">
            <div>
              <span>Last 14 days · UTC</span>
              <h2 id="ops-tx-chart-title">Transaction volume</h2>
            </div>
            <div className="ops-chart-metrics">
              <span><small>Total</small><strong>{chart.periodCount}</strong></span>
              <span><small>Buy</small><strong>{buyCount}</strong></span>
              <span><small>Sell</small><strong>{sellCount}</strong></span>
            </div>
          </header>
          <div className="ops-chart-stage">
            <svg viewBox={`0 0 ${CHART_WIDTH} 240`} role="img" aria-label={`${chart.periodCount} transactions across fourteen UTC days`}>
              <defs>
                <linearGradient id="ops-tx-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#087f91" stopOpacity=".2" />
                  <stop offset="1" stopColor="#087f91" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3, 4].map((index) => {
                const y = CHART_TOP + index * ((CHART_BOTTOM - CHART_TOP) / 4);
                const label = Math.round(chart.maximum * (1 - index / 4));
                return (
                  <g key={`grid-${index}`}>
                    <line className="ops-chart-grid" x1={CHART_LEFT} x2={CHART_RIGHT} y1={y} y2={y} />
                    <text className="ops-chart-axis" x={CHART_LEFT - 8} y={y + 4} textAnchor="end">{label}</text>
                  </g>
                );
              })}
              {chart.periodCount > 0 ? (
                <>
                  <path className="ops-chart-area" d={chart.area} />
                  <path className="ops-chart-line" d={chart.line} />
                </>
              ) : null}
              {chart.points
                .filter((_, index) => index === 0 || index === 4 || index === 9 || index === chart.points.length - 1)
                .map((point) => (
                  <text className="ops-chart-axis" x={point.x} y="232" textAnchor="middle" key={point.day}>{dayLabel(point.day)}</text>
                ))}
            </svg>
            {chart.periodCount === 0 ? (
              <div className="ops-chart-empty">
                <strong>No transactions in this window</strong>
                <span>Volume will appear here as conversions settle.</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="ops-panel" aria-labelledby="ops-fx-title">
          <header className="ops-panel-heading">
            <div>
              <span>Daily majors</span>
              <h2 id="ops-fx-title">Exchange rates</h2>
            </div>
          </header>
          <p className="ops-panel-copy">
            Majors use a 24-hour TTL. Fee and earnings estimates convert through this board into {currency}.
          </p>
          <div className="ops-fx-grid">
            {overview.majorRates.map((rate) => (
              <article className={`ops-fx-card ${rate.freshness.toLowerCase()}`} key={`${rate.baseCurrency}-${rate.quoteCurrency}`}>
                <span>{rate.baseCurrency}<i>/</i>{rate.quoteCurrency}</span>
                <strong>{rateLabel(rate.rate)}</strong>
                <small>
                  <Badge tone={toneForStatus(rate.freshness === "FRESH" ? "READY" : rate.freshness === "STALE" ? "FAILED" : "PENDING")} dot>
                    {rate.freshness}
                  </Badge>
                  {" "}{asString(rate.source, "—")}
                </small>
              </article>
            ))}
          </div>
          {canPublishRates ? <PublishMajorRatesButton /> : null}
        </section>
      </div>

      {(month.byAsset?.length ?? 0) > 0 ? (
        <section className="ops-panel" aria-labelledby="ops-fee-assets-title">
          <header className="ops-panel-heading">
            <div>
              <span>Month to date</span>
              <h2 id="ops-fee-assets-title">Fee accumulation by currency</h2>
            </div>
          </header>
          <DataTable
            columns={[
              { key: "asset", header: "Fee asset", render: (row) => asString(row.asset) },
              { key: "tx", header: "Txns", render: (row) => String(row.transactions ?? 0) },
              { key: "native", header: "Revenue (native)", render: (row) => formatAmount(row.feeRevenueNative, row.asset) },
              { key: "reporting", header: `Revenue (${currency})`, render: (row) => money(row.feeRevenueReporting as number | string, currency) },
              { key: "costs", header: `Costs (${currency})`, render: (row) => money(row.providerCostsReporting as number | string, currency) },
              {
                key: "profit",
                header: `Profit (${currency})`,
                render: (row) => row.realizedProfitReporting == null ? "Pending" : money(row.realizedProfitReporting as number | string, currency),
              },
              { key: "fx", header: "FX source", render: (row) => asString(row.conversionSource, "—") },
            ]}
            rows={month.byAsset}
            getKey={(row) => asString(row.asset)}
          />
        </section>
      ) : null}

      <section className="ops-panel" aria-labelledby="ops-recent-tx-title">
        <header className="ops-panel-heading">
          <div>
            <span>Latest book</span>
            <h2 id="ops-recent-tx-title">Transactions</h2>
          </div>
          <Link className="ops-link" href="/transactions">View all</Link>
        </header>
        <DataTable
          columns={[
            {
              key: "id",
              header: "Transaction",
              render: (row) => {
                const href = `/transactions/${row.id}`;
                return (
                  <span className="ops-tx-lead">
                    <CurrencyPairClip from={row.sourceAsset} to={row.destinationAsset} size="sm" />
                    <Link className="ops-link" href={href}>{row.id.slice(0, 8)}…</Link>
                  </span>
                );
              },
            },
            { key: "provider", header: "Provider", render: (row) => row.provider },
            { key: "type", header: "Type", render: (row) => row.transactionType },
            {
              key: "status",
              header: "Status",
              render: (row) => <Badge tone={toneForStatus(row.status)} dot>{row.status}</Badge>,
            },
            {
              key: "source",
              header: "Source",
              render: (row) => formatAmount(row.sourceAmount, row.sourceAsset),
            },
            {
              key: "destination",
              header: "Destination",
              render: (row) => formatAmount(row.destinationAmount, row.destinationAsset),
            },
            {
              key: "fee",
              header: "Platform fee",
              render: (row) => row.platformFeeAmount == null
                ? "—"
                : formatAmount(row.platformFeeAmount, row.platformFeeAsset),
            },
            {
              key: "earn",
              header: `Platform fee (${currency})`,
              render: (row) => row.estimatedEarningsReporting == null
                ? "—"
                : money(row.estimatedEarningsReporting, currency),
            },
            { key: "updated", header: "Updated", render: (row) => formatInstant(row.updatedAt) },
          ]}
          rows={overview.recentTransactions}
          getKey={(row) => row.id}
          empty={<EmptyState compact title="No transactions yet" description="Converted routes will land here with currency and fee estimates." />}
        />
      </section>

      <section className="ops-panel ops-health-strip" aria-label="Operational health">
        <h2>Operational health</h2>
        <div className="ops-health-grid">
          <span>Stuck txs <Link className="ops-link" href="/transactions?status=PROCESSING"><strong>{readiness.stuckTransactions}</strong></Link></span>
          <span>Compliance <Link className="ops-link" href="/transactions?status=COMPLIANCE_REVIEW"><strong>{readiness.complianceReviewTransactions}</strong></Link></span>
          <span>Reconciliation <Link className="ops-link" href="/reconciliation"><strong>{readiness.criticalReconciliationItems}</strong></Link></span>
          <span>Unvalued costs <Link className="ops-link" href="/treasury"><strong>{readiness.incompleteCostValuations}</strong></Link></span>
          <span>Stale webhooks <Link className="ops-link" href="/webhooks"><strong>{readiness.staleProviderWebhooks}</strong></Link></span>
          <span>Failed notices <Link className="ops-link" href="/notifications?status=FAILED"><strong>{readiness.exhaustedNotificationDeliveries}</strong></Link></span>
        </div>
      </section>
    </div>
  );
}
