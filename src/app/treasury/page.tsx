import type { Metadata } from "next";
import Link from "next/link";
import { CsvExportButton } from "@/components/csv-export-button";
import { OpsShell } from "@/components/ops-shell";
import { PageNav } from "@/components/page-nav";
import { ViewLink } from "@/components/view-link";
import { TreasuryDeskActions } from "@/components/treasury-desk-actions";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { loadPage } from "@/lib/admin-load";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { relatedHref } from "@/lib/related-href";
import { formatAmount, formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Treasury" };

type Search = Promise<{ status?: string | string[]; page?: string | string[]; alertsPage?: string | string[] }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function TreasuryPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const status = first(params.status) || "OPEN";
  const page = Math.max(0, Number(first(params.page) || 0) || 0);
  const alertsPage = Math.max(0, Number(first(params.alertsPage) || 0) || 0);
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.treasuryView, "/treasury");
  const canManage = hasPermission(principal.permissions, PERMISSIONS.treasuryManage);

  const taskQuery = new URLSearchParams({ page: String(page), size: String(size) });
  if (status && status !== "ANY") taskQuery.set("status", status);
  const alertQuery = new URLSearchParams({ page: String(alertsPage), size: String(size) });

  const [tasksResponse, alertsResponse] = await Promise.all([
    adminBackend(token, `/v1/admin/treasury/tasks?${taskQuery}`),
    adminBackend(token, `/v1/admin/automatic-conversion-alerts?${alertQuery}`),
  ]);

  const tasksLoad = await loadPage(tasksResponse, { page, size });
  const alertsLoad = await loadPage(alertsResponse, { page: alertsPage, size });
  const tasks = tasksLoad.rows;
  const alerts = alertsLoad.rows;
  const tasksTotal = Number(tasksLoad.data.total ?? 0) || 0;
  const alertsTotal = Number(alertsLoad.data.total ?? 0) || 0;

  const taskActions = tasks.map((row) => ({
    id: text(row, "id"),
    conversionId: text(row, "conversion_id", "conversionId"),
    type: text(row, "type", "task_type", "taskType"),
    status: text(row, "status"),
    asset: text(row, "asset", "asset_code", "assetCode"),
    actionRequired: text(row, "action_required", "actionRequired"),
  }));
  const alertActions = alerts.map((row) => ({
    id: text(row, "id"),
    title: text(row, "title"),
    status: text(row, "status"),
    relatedType: text(row, "related_type", "relatedType"),
    relatedId: text(row, "related_id", "relatedId"),
  }));

  function tasksHref(nextPage: number) {
    const next = new URLSearchParams();
    if (status) next.set("status", status);
    if (nextPage > 0) next.set("page", String(nextPage));
    if (alertsPage > 0) next.set("alertsPage", String(alertsPage));
    const search = next.toString();
    return search ? `/treasury?${search}` : "/treasury";
  }

  function alertsHref(nextPage: number) {
    const next = new URLSearchParams();
    if (status) next.set("status", status);
    if (page > 0) next.set("page", String(page));
    if (nextPage > 0) next.set("alertsPage", String(nextPage));
    const search = next.toString();
    return search ? `/treasury?${search}` : "/treasury";
  }

  return (
    <OpsShell
      principal={principal}
      eyebrow="Liquidity desk"
      title="Treasury"
      copy="Funding evidence, DOT tasks, automatic conversion alerts, and Safe Haven master accounts."
    >
      <p className="ops-copy">
        <Link className="ops-link" href="/treasury/ngn-masters">
          Manage NGN master accounts →
        </Link>
      </p>
      <div className="ops-stat-grid">
        <article className="ops-stat-card accent"><span>Listed tasks</span><strong>{tasksLoad.ok ? tasksTotal : "—"}</strong><small>Current filter</small></article>
        <article className="ops-stat-card"><span>Listed alerts</span><strong>{alertsLoad.ok ? alertsTotal : "—"}</strong><small>Current page set</small></article>
        <article className="ops-stat-card"><span>Page size</span><strong>{size}</strong><small>Tasks and alerts</small></article>
      </div>

      <form className="ops-toolbar" method="get">
        <label className="sp-field">
          <span>Status</span>
          <select name="status" defaultValue={status}>
            <option value="ANY">Any status</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>
        <button className="sp-button primary medium" type="submit">Filter</button>
        <CsvExportButton
          filename="treasury-tasks.csv"
          headers={["id", "type", "status", "direction", "asset", "required", "shortfall", "action"]}
          rows={tasks.map((row) => [
            text(row, "id"),
            text(row, "type", "task_type", "taskType"),
            text(row, "status"),
            text(row, "direction"),
            text(row, "asset", "asset_code", "assetCode"),
            String(row.required_amount ?? row.requiredAmount ?? ""),
            String(row.shortfall_amount ?? row.shortfallAmount ?? ""),
            text(row, "action_required", "actionRequired"),
          ])}
        />
      </form>

      {canManage ? (
        <section className="ops-panel">
          <h2>Work actions</h2>
          <TreasuryDeskActions canManage={canManage} tasks={taskActions} alerts={alertActions} />
        </section>
      ) : null}

      <section className="ops-panel">
        <h2>Treasury tasks</h2>
        {!tasksLoad.ok ? (
          <EmptyState compact title="Treasury tasks unavailable" description={tasksLoad.error} />
        ) : (
          <>
            <PageNav page={tasksLoad.data.page ?? page} size={size} total={tasksTotal} hrefFor={tasksHref} />
            <DataTable
              columns={[
                { key: "type", header: "Type", render: (row) => text(row, "type", "task_type", "taskType") },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge>,
                },
                { key: "direction", header: "Direction", render: (row) => text(row, "direction") },
                { key: "asset", header: "Asset", render: (row) => text(row, "asset", "asset_code", "assetCode") },
                {
                  key: "required",
                  header: "Required",
                  render: (row) => formatAmount(row.required_amount ?? row.requiredAmount, row.asset ?? row.asset_code ?? row.assetCode),
                },
                {
                  key: "shortfall",
                  header: "Shortfall",
                  render: (row) => formatAmount(row.shortfall_amount ?? row.shortfallAmount, row.asset ?? row.asset_code ?? row.assetCode),
                },
                { key: "action", header: "Action required", render: (row) => text(row, "action_required", "actionRequired") },
                { key: "created", header: "Created", render: (row) => formatInstant(row.created_at ?? row.createdAt) },
                {
                  key: "details",
                  header: "",
                  render: (row) => <ViewLink href={`/treasury/tasks/${text(row, "id")}`} />,
                },
              ]}
              rows={tasks}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No treasury tasks" description="Funding evidence and DOT tasks show up here." />}
            />
            <PageNav page={tasksLoad.data.page ?? page} size={size} total={tasksTotal} hrefFor={tasksHref} />
          </>
        )}
      </section>

      <section className="ops-panel">
        <h2>Conversion alerts</h2>
        {!alertsLoad.ok ? (
          <EmptyState compact title="Conversion alerts unavailable" description={alertsLoad.error} />
        ) : (
          <>
            <PageNav page={alertsLoad.data.page ?? alertsPage} size={size} total={alertsTotal} hrefFor={alertsHref} />
            <DataTable
              columns={[
                {
                  key: "severity",
                  header: "Severity",
                  render: (row) => <Badge tone={toneForStatus(text(row, "severity"))}>{text(row, "severity")}</Badge>,
                },
                { key: "title", header: "Title", render: (row) => text(row, "title") },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge>,
                },
                {
                  key: "related",
                  header: "Related",
                  render: (row) => {
                    const relatedType = text(row, "related_type", "relatedType");
                    const relatedId = text(row, "related_id", "relatedId");
                    const href = relatedHref(relatedType, relatedId);
                    const label = `${relatedType} · ${relatedId === "—" ? "—" : `${relatedId.slice(0, 8)}…`}`;
                    return href ? <Link className="ops-link" href={href}>{label}</Link> : label;
                  },
                },
                { key: "message", header: "Message", render: (row) => text(row, "message") },
                { key: "created", header: "Created", render: (row) => formatInstant(row.created_at ?? row.createdAt) },
                {
                  key: "details",
                  header: "",
                  render: (row) => <ViewLink href={`/treasury/alerts/${text(row, "id")}`} />,
                },
              ]}
              rows={alerts}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No conversion alerts" description="Automatic conversion alerts will appear here." />}
            />
            <PageNav page={alertsLoad.data.page ?? alertsPage} size={size} total={alertsTotal} hrefFor={alertsHref} />
          </>
        )}
      </section>
    </OpsShell>
  );
}
