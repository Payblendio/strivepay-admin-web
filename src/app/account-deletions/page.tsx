import type { Metadata } from "next";
import Link from "next/link";
import { AccountDeletionCompleteButton } from "@/components/account-deletion-complete-button";
import { OpsShell } from "@/components/ops-shell";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { loadList } from "@/lib/admin-load";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { formatInstant, text } from "@/lib/values";

export const metadata: Metadata = { title: "Account deletions" };

type Search = Promise<{ status?: string | string[] }>;

const STATUSES = ["CLOSED", "PENDING_CONFIRMATION", "COMPLETED", "CANCELLED"];

function tone(status: string) {
  if (status === "CLOSED") return "warning" as const;
  if (status === "COMPLETED") return "success" as const;
  return "neutral" as const;
}

export default async function AccountDeletionsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = raw === undefined ? "CLOSED" : STATUSES.includes(raw) ? raw : "";
  const { token, principal } = await requireAdmin(PERMISSIONS.customersView, "/account-deletions");
  const canManage = hasPermission(principal.permissions, PERMISSIONS.customersManage);
  const response = await adminBackend(token, `/v1/admin/account-deletions${status ? `?status=${status}` : ""}`);
  const load = await loadList(response);

  return (
    <OpsShell
      principal={principal}
      eyebrow="Customers"
      title="Account deletions"
      copy="Accounts closed by customers. Remove personal data, keep regulated records for 5 years, then mark the request completed."
    >
      <form className="ops-toolbar" method="get">
        <label className="sp-field">
          <span>Status</span>
          <select name="status" defaultValue={status}>
            <option value="">Any status</option>
            <option value="CLOSED">Closed, awaiting review</option>
            <option value="PENDING_CONFIRMATION">Awaiting email confirmation</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        <button className="sp-button primary medium" type="submit">Filter</button>
      </form>

      <section className="ops-panel">
        {!load.ok ? (
          <EmptyState compact title="Account deletions unavailable" description={load.error} />
        ) : (
          <>
            <div className="ops-panel-heading">
              <div>
                <span>Queue</span>
                <h2>{load.rows.length} request{load.rows.length === 1 ? "" : "s"}</h2>
              </div>
            </div>
            <DataTable
              columns={[
                {
                  key: "customer",
                  header: "Customer",
                  render: (row) => (
                    <span className="ops-cell-stack">
                      <Link className="ops-link ops-cell-truncate" href={`/customers/${text(row, "partyId")}`}>{text(row, "customerName")}</Link>
                      <small className="ops-cell-truncate" title={text(row, "email")}>{text(row, "email")}</small>
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <span className="ops-cell-stack">
                      <Badge tone={tone(text(row, "status"))} dot>{text(row, "status")}</Badge>
                      <small>via {text(row, "source") === "APP" ? "app" : "web"}</small>
                    </span>
                  ),
                },
                {
                  key: "reason",
                  header: "Reason",
                  render: (row) => {
                    const reason = text(row, "reason");
                    return <span className="ops-cell-truncate" title={reason}>{reason}</span>;
                  },
                },
                {
                  key: "open",
                  header: "Open transactions",
                  align: "center",
                  render: (row) => {
                    const open = Number(row.openTransactions ?? 0);
                    return open > 0 ? <Badge tone="warning">{open}</Badge> : "0";
                  },
                },
                {
                  key: "dates",
                  header: "Closed",
                  render: (row) => (
                    <span className="ops-cell-stack">
                      <span>{formatInstant(row.closedAt ?? row.requestedAt)}</span>
                      <small>Keep until {formatInstant(row.retentionUntil)}</small>
                    </span>
                  ),
                },
                {
                  key: "review",
                  header: "Review",
                  render: (row) => text(row, "status") === "COMPLETED" ? (
                    <span className="ops-cell-stack">
                      <span className="ops-cell-truncate" title={text(row, "adminNote")}>{text(row, "adminNote")}</span>
                      <small>{text(row, "completedBy")} · {formatInstant(row.completedAt)}</small>
                    </span>
                  ) : "—",
                },
                {
                  key: "actions",
                  header: "",
                  render: (row) => canManage && text(row, "status") === "CLOSED" ? (
                    <span className="ops-row-actions"><AccountDeletionCompleteButton id={text(row, "id")} /></span>
                  ) : null,
                },
              ]}
              rows={load.rows}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No account deletions" description="Accounts customers close will appear here for review." />}
            />
          </>
        )}
      </section>
    </OpsShell>
  );
}
