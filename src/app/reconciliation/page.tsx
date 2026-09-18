import type { Metadata } from "next";
import Link from "next/link";
import { CsvExportButton } from "@/components/csv-export-button";
import { OpsShell } from "@/components/ops-shell";
import { PageNav } from "@/components/page-nav";
import { ViewLink } from "@/components/view-link";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { loadPage } from "@/lib/admin-load";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Reconciliation" };

type Search = Promise<{ status?: string | string[]; page?: string | string[] }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ReconciliationPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const status = first(params.status);
  const page = Math.max(0, Number(first(params.page) || 0) || 0);
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.coverageView, "/reconciliation");
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) query.set("status", status);
  const response = await adminBackend(token, `/v1/admin/reconciliation?${query}`);
  const load = await loadPage(response, { page, size });
  const rows = load.rows;
  const data = load.data;

  function hrefFor(nextPage: number) {
    const next = new URLSearchParams();
    if (status) next.set("status", status);
    if (nextPage > 0) next.set("page", String(nextPage));
    const search = next.toString();
    return search ? `/reconciliation?${search}` : "/reconciliation";
  }

  return (
    <OpsShell
      principal={principal}
      eyebrow="Coverage"
      title="Reconciliation"
      copy="Provider mismatches waiting for ops review."
    >
      <form className="ops-toolbar" method="get">
        <label className="sp-field">
          <span>Status</span>
          <select name="status" defaultValue={status}>
            <option value="">Any status</option>
            <option value="OPEN">OPEN</option>
            <option value="INVESTIGATING">INVESTIGATING</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="IGNORED">IGNORED</option>
          </select>
        </label>
        <button className="sp-button primary medium" type="submit">Filter</button>
        <CsvExportButton
          filename="reconciliation.csv"
          headers={["id", "order", "provider", "severity", "status", "mismatch", "created"]}
          rows={rows.map((row) => [
            text(row, "id"),
            text(row, "order_id", "orderId"),
            text(row, "provider_code", "providerCode"),
            text(row, "severity"),
            text(row, "status"),
            text(row, "mismatch_type", "mismatchType"),
            String(row.created_at ?? row.createdAt ?? ""),
          ])}
        />
      </form>

      <section className="ops-panel">
        {!load.ok ? (
          <EmptyState compact title="Reconciliation unavailable" description={load.error} />
        ) : (
          <>
            <PageNav page={data.page ?? page} size={data.size ?? size} total={data.total ?? 0} hrefFor={hrefFor} />
            <DataTable
              columns={[
                { key: "provider", header: "Provider", render: (row) => text(row, "provider_code", "providerCode") },
                {
                  key: "severity",
                  header: "Severity",
                  render: (row) => <Badge tone={toneForStatus(text(row, "severity"))}>{text(row, "severity")}</Badge>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge>,
                },
                { key: "mismatch", header: "Mismatch", render: (row) => text(row, "mismatch_type", "mismatchType") },
                {
                  key: "order",
                  header: "Order",
                  render: (row) => {
                    const orderId = text(row, "order_id", "orderId");
                    return orderId === "—"
                      ? "—"
                      : <Link className="ops-link" href={`/transactions/${orderId}`}>{orderId.slice(0, 8)}…</Link>;
                  },
                },
                { key: "expected", header: "Expected", render: (row) => text(row, "expected") },
                { key: "actual", header: "Actual", render: (row) => text(row, "actual") },
                { key: "created", header: "Created", render: (row) => formatInstant(row.created_at ?? row.createdAt) },
                {
                  key: "details",
                  header: "",
                  render: (row) => <ViewLink href={`/reconciliation/${text(row, "id")}`} />,
                },
              ]}
              rows={rows}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No reconciliation items" description="Provider mismatches will appear here." />}
            />
            <PageNav page={data.page ?? page} size={data.size ?? size} total={data.total ?? 0} hrefFor={hrefFor} />
          </>
        )}
      </section>
    </OpsShell>
  );
}
