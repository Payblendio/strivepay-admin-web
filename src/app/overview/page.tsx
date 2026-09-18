import type { Metadata } from "next";
import { OpsShell } from "@/components/ops-shell";
import { OverviewDashboard } from "@/components/overview-dashboard";
import { RuntimeAlertsPanel } from "@/components/runtime-alerts-panel";
import { Badge } from "@/components/ui/primitives";
import { redirect } from "next/navigation";
import { canSeeOverview, hasPermission, homePath, PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import type { AdminOverview, WorkerHeartbeat } from "@/lib/admin-types";
import { asRecord, formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { token, principal } = await requireAdmin(undefined, "/overview");
  if (!canSeeOverview(principal.permissions)) redirect(homePath(principal.permissions));

  const canOverview = hasPermission(principal.permissions, PERMISSIONS.feesView)
    || hasPermission(principal.permissions, PERMISSIONS.transactionsView);
  const canWorker = hasPermission(principal.permissions, PERMISSIONS.coverageView);
  const canPublishRates = hasPermission(principal.permissions, PERMISSIONS.feesManage);
  const canRuntime = hasPermission(principal.permissions, PERMISSIONS.coverageView)
    || hasPermission(principal.permissions, PERMISSIONS.notificationsManage);
  const canAckAlerts = hasPermission(principal.permissions, PERMISSIONS.notificationsManage);

  const [overviewResponse, workerResponse, alertsResponse, budgetsResponse, readinessResponse] = await Promise.all([
    canOverview ? adminBackend(token, "/v1/admin/overview?reportingCurrency=USD") : Promise.resolve(null),
    canWorker ? adminBackend(token, "/v1/admin/runtime/worker") : Promise.resolve(null),
    canRuntime ? adminBackend(token, "/v1/admin/runtime/operational-alerts") : Promise.resolve(null),
    canRuntime ? adminBackend(token, "/v1/admin/runtime/error-budgets") : Promise.resolve(null),
    canRuntime ? adminBackend(token, "/v1/admin/runtime/operational-readiness") : Promise.resolve(null),
  ]);

  const overview = overviewResponse?.ok ? await responseBody(overviewResponse) as AdminOverview : null;
  const worker = workerResponse?.ok ? await responseBody(workerResponse) as WorkerHeartbeat : null;
  const alertsOk = !canRuntime || alertsResponse?.ok === true;
  const budgetsOk = !canRuntime || budgetsResponse?.ok === true;
  const alertPayload = alertsResponse?.ok ? await responseBody(alertsResponse) : [];
  const budgetPayload = budgetsResponse?.ok ? await responseBody(budgetsResponse) : [];
  const readinessPayload = readinessResponse?.ok ? await responseBody(readinessResponse) : null;

  const alerts = (Array.isArray(alertPayload) ? alertPayload : []).map(asRecord).map((row) => ({
    id: text(row, "id"),
    title: text(row, "title"),
    severity: text(row, "severity"),
    status: text(row, "status"),
  }));
  const budgets = (Array.isArray(budgetPayload) ? budgetPayload : []).map(asRecord);
  const readiness = readinessPayload && typeof readinessPayload === "object" ? asRecord(readinessPayload) : null;

  return (
    <OpsShell
      principal={principal}
      eyebrow="Operations desk"
      title="Overview"
      copy="Fee accumulation, daily FX majors, estimated earnings, and conversion volume."
    >
      {overview ? (
        <OverviewDashboard overview={overview} canPublishRates={canPublishRates} />
      ) : canOverview ? (
        <div className="ops-panel"><p>Overview economics are unavailable right now.</p></div>
      ) : null}

      {canWorker ? (
        <section className="ops-panel">
          <h2>Worker heartbeat</h2>
          {worker ? (
            <p>
              <Badge tone={toneForStatus(worker.status)} dot>{worker.status}</Badge>
              {" "}Environment {worker.environment || "—"}. Last seen {formatInstant(worker.lastSeenAt)}
              {worker.ageSeconds != null ? ` (${worker.ageSeconds}s ago)` : ""}.
            </p>
          ) : (
            <p>Worker status is unavailable right now.</p>
          )}
        </section>
      ) : null}

      {canRuntime ? (
        <>
          <section className="ops-panel">
            <h2>Operational readiness</h2>
            {readiness ? (
              <p>
                <Badge tone={toneForStatus(text(readiness, "status", "state", "ready"))} dot>
                  {text(readiness, "status", "state", "ready")}
                </Badge>
                {" "}{text(readiness, "summary", "message", "detail")}
              </p>
            ) : (
              <p>Readiness is unavailable right now.</p>
            )}
          </section>
          <section className="ops-panel">
            <h2>Error budgets</h2>
            {!budgetsOk ? (
              <p>Error budgets are unavailable right now.</p>
            ) : budgets.length ? (
              <div className="ops-stat-grid">
                {budgets.slice(0, 6).map((row) => (
                  <article className="ops-stat-card" key={text(row, "id", "name", "slug")}>
                    <span>{text(row, "name", "slug", "service")}</span>
                    <strong>{text(row, "remaining", "budget", "status")}</strong>
                    <small>{text(row, "window", "period", "detail")}</small>
                  </article>
                ))}
              </div>
            ) : (
              <p>No error-budget snapshots.</p>
            )}
          </section>
          <section className="ops-panel">
            <h2>Operational alerts</h2>
            {!alertsOk ? (
              <p>Operational alerts are unavailable right now.</p>
            ) : (
              <RuntimeAlertsPanel alerts={alerts} canAck={canAckAlerts} />
            )}
          </section>
        </>
      ) : null}
    </OpsShell>
  );
}
