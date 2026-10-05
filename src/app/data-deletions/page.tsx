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

export const metadata: Metadata = { title: "Data deletions" };

type Search = Promise<{ status?: string | string[] }>;

const STATUSES = ["CONFIRMED", "PENDING_CONFIRMATION", "COMPLETED", "REJECTED"];

const LABELS: Record<string, string> = {
  PHONE_NUMBER: "Phone number",
  PUSH_DEVICES: "Push devices (removed automatically)",
  SAVED_DESTINATIONS: "Saved bank accounts & wallets",
  SUPPORT_HISTORY: "Support history",
};

function tone(status: string) {
  if (status === "CONFIRMED") return "warning" as const;
  if (status === "COMPLETED") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  return "neutral" as const;
}

export default async function DataDeletionsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = raw === undefined ? "CONFIRMED" : STATUSES.includes(raw) ? raw : "";
  const { token, principal } = await requireAdmin(PERMISSIONS.customersView, "/data-deletions");
  const canManage = hasPermission(principal.permissions, PERMISSIONS.customersManage);
  const response = await adminBackend(token, `/v1/admin/data-deletions${status ? `?status=${status}` : ""}`);
  const load = await loadList(response);

  return (
    <OpsShell
      principal={principal}
      eyebrow="Customers"
      title="Data deletions"
      copy="Customers asking to delete specific data while keeping their account. Complete within 30 days of confirmation; regulated records stay."
    >
      <form className="ops-toolbar" method="get">
        <label className="sp-field">
          <span>Status</span>
          <select name="status" defaultValue={status}>
            <option value="">Any status</option>
            <option value="CONFIRMED">Confirmed, awaiting review</option>
            <option value="PENDING_CONFIRMATION">Awaiting email confirmation</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
        <button className="sp-button primary medium" type="submit">Filter</button>
      </form>

      <section className="ops-panel">
        {!load.ok ? (
          <EmptyState compact title="Data deletions unavailable" description={load.error} />
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
                  key: "data",
                  header: "Data to delete",
                  render: (row) => {
                    const categories = Array.isArray(row.categories) ? row.categories.map(String) : [];
                    const note = text(row, "note");
                    return (
                      <span className="ops-cell-stack">
                        <span>{categories.map((c) => LABELS[c] ?? c).join(", ") || "—"}</span>
                        {note !== "—" ? <small className="ops-cell-truncate" title={note}>{note}</small> : null}
                      </span>
                    );
                  },
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <Badge tone={tone(text(row, "status"))} dot>{text(row, "status")}</Badge>,
                },
                {
                  key: "dates",
                  header: "Confirmed",
                  render: (row) => (
                    <span className="ops-cell-stack">
                      <span>{formatInstant(row.confirmedAt ?? row.requestedAt)}</span>
                      <small>Requested {formatInstant(row.requestedAt)}</small>
                    </span>
                  ),
                },
                {
                  key: "review",
                  header: "Review",
                  render: (row) => ["COMPLETED", "REJECTED"].includes(text(row, "status")) ? (
                    <span className="ops-cell-stack">
                      <span className="ops-cell-truncate" title={text(row, "adminNote")}>{text(row, "adminNote")}</span>
                      <small>{text(row, "completedBy")} · {formatInstant(row.completedAt)}</small>
                    </span>
                  ) : "—",
                },
                {
                  key: "actions",
                  header: "",
                  render: (row) => {
                    const id = text(row, "id");
                    return canManage && text(row, "status") === "CONFIRMED" ? (
                      <span className="ops-row-actions">
                        <AccountDeletionCompleteButton id={id} path={`/api/admin/data-deletions/${id}/complete`} title="Mark data deleted"
                          text="Confirm the selected data has been removed. The customer is emailed and this note is kept in the audit log." />
                        <AccountDeletionCompleteButton id={id} path={`/api/admin/data-deletions/${id}/reject`} label="Reject" variant="quiet" title="Reject request"
                          text="Explain why the data can't be deleted (for example, an open transaction or a regulatory hold). The customer is emailed." />
                      </span>
                    ) : null;
                  },
                },
              ]}
              rows={load.rows}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No data deletion requests" description="Confirmed requests from customers will appear here." />}
            />
          </>
        )}
      </section>
    </OpsShell>
  );
}
