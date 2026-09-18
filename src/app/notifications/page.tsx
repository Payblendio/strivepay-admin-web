import type { Metadata } from "next";
import { DeliveryRetryButton } from "@/components/delivery-retry-button";
import { OpsShell } from "@/components/ops-shell";
import { PageNav } from "@/components/page-nav";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { loadPage } from "@/lib/admin-load";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Notifications" };

type Search = Promise<{ status?: string | string[]; page?: string | string[] }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function NotificationsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const status = first(params.status);
  const page = Math.max(0, Number(first(params.page) || 0) || 0);
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.notificationsView, "/notifications");
  const canManage = hasPermission(principal.permissions, PERMISSIONS.notificationsManage);
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) query.set("status", status);
  const response = await adminBackend(token, `/v1/admin/notifications/deliveries?${query}`);
  const load = await loadPage(response, { page, size });
  const rows = load.rows;
  const data = load.data;

  function hrefFor(nextPage: number) {
    const next = new URLSearchParams();
    if (status) next.set("status", status);
    if (nextPage > 0) next.set("page", String(nextPage));
    const search = next.toString();
    return search ? `/notifications?${search}` : "/notifications";
  }

  return (
    <OpsShell
      principal={principal}
      eyebrow="Platform"
      title="Notifications"
      copy="Outbound notification deliveries and retries."
    >
      <form className="ops-toolbar" method="get">
        <label className="sp-field">
          <span>Status</span>
          <select name="status" defaultValue={status}>
            <option value="">Any status</option>
            <option value="PENDING">PENDING</option>
            <option value="FAILED">FAILED</option>
            <option value="DELIVERED">DELIVERED</option>
          </select>
        </label>
        <button className="sp-button primary medium" type="submit">Filter</button>
      </form>

      <section className="ops-panel">
        {!load.ok ? (
          <EmptyState compact title="Notifications unavailable" description={load.error} />
        ) : (
          <>
            <PageNav page={data.page ?? page} size={data.size ?? size} total={data.total ?? 0} hrefFor={hrefFor} />
            <DataTable
              columns={[
                { key: "channel", header: "Channel", render: (row) => text(row, "channel") },
                { key: "destination", header: "Destination", render: (row) => text(row, "destination") },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge>,
                },
                { key: "attempts", header: "Attempts", render: (row) => text(row, "attempts", "attempt_count", "attemptCount") },
                { key: "error", header: "Last error", render: (row) => text(row, "last_error", "lastError") },
                { key: "created", header: "Created", render: (row) => formatInstant(row.created_at ?? row.createdAt) },
                {
                  key: "retry",
                  header: "",
                  render: (row) => {
                    const deliveryStatus = text(row, "status").toUpperCase();
                    if (!canManage || deliveryStatus !== "FAILED") return null;
                    return <DeliveryRetryButton path={`/api/admin/notifications/deliveries/${text(row, "id")}/retry`} />;
                  },
                },
              ]}
              rows={rows}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No notification deliveries" description="Failed or pending deliveries will show up here." />}
            />
            <PageNav page={data.page ?? page} size={data.size ?? size} total={data.total ?? 0} hrefFor={hrefFor} />
          </>
        )}
      </section>
    </OpsShell>
  );
}
