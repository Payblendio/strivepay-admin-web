import type { Metadata } from "next";
import Link from "next/link";
import { DeliveryRetryButton } from "@/components/delivery-retry-button";
import { NotificationChannelIcon } from "@/components/notification-channel-icon";
import { OpsShell } from "@/components/ops-shell";
import { PageNav } from "@/components/page-nav";
import { ViewLink } from "@/components/view-link";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { loadPage } from "@/lib/admin-load";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Notifications" };

type Search = Promise<{ status?: string | string[]; channel?: string | string[]; page?: string | string[] }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function NotificationsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const status = first(params.status);
  const channel = first(params.channel);
  const page = Math.max(0, Number(first(params.page) || 0) || 0);
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.notificationsView, "/notifications");
  const canManage = hasPermission(principal.permissions, PERMISSIONS.notificationsManage);
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) query.set("status", status);
  if (channel) query.set("channel", channel);
  const response = await adminBackend(token, `/v1/admin/notifications/deliveries?${query}`);
  const load = await loadPage(response, { page, size });
  const rows = load.rows;
  const data = load.data;
  const total = Number(data.total ?? 0) || 0;

  function hrefFor(nextPage: number) {
    const next = new URLSearchParams();
    if (status) next.set("status", status);
    if (channel) next.set("channel", channel);
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
          <span>Channel</span>
          <select name="channel" defaultValue={channel}>
            <option value="">Any channel</option>
            <option value="EMAIL">Email</option>
            <option value="PUSH">Push</option>
          </select>
        </label>
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
            <div className="ops-panel-heading">
              <div>
                <span>Outbox</span>
                <h2>{total} deliver{total === 1 ? "y" : "ies"}</h2>
              </div>
            </div>
            <PageNav page={data.page ?? page} size={data.size ?? size} total={total} hrefFor={hrefFor} />
            <DataTable
              columns={[
                {
                  key: "notification",
                  header: "Notification",
                  render: (row) => {
                    const id = text(row, "id");
                    return (
                      <span className="ops-tx-lead">
                        <NotificationChannelIcon channel={text(row, "channel")} />
                        <span className="ops-cell-stack">
                          <Link className="ops-link ops-cell-truncate" href={`/notifications/${id}`} title={text(row, "title")}>
                            {text(row, "title")}
                          </Link>
                          <small className="ops-cell-truncate">{text(row, "type")}</small>
                        </span>
                      </span>
                    );
                  },
                },
                {
                  key: "recipient",
                  header: "Recipient",
                  render: (row) => (
                    <span className="ops-cell-stack">
                      <span className="ops-cell-truncate" title={text(row, "destination")}>{text(row, "destination")}</span>
                      <small>{text(row, "channel") === "PUSH" ? text(row, "devicePlatform") : text(row, "channel")}</small>
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge>,
                },
                { key: "attempts", header: "Attempts", align: "center", render: (row) => text(row, "attempts", "attempt_count", "attemptCount") },
                {
                  key: "error",
                  header: "Last error",
                  render: (row) => {
                    const error = text(row, "last_error", "lastError");
                    return error === "—" ? "—" : <span className="ops-cell-truncate ops-cell-error" title={error}>{error}</span>;
                  },
                },
                { key: "created", header: "Created", render: (row) => formatInstant(row.created_at ?? row.createdAt) },
                {
                  key: "actions",
                  header: "",
                  render: (row) => {
                    const deliveryStatus = text(row, "status").toUpperCase();
                    return (
                      <span className="ops-row-actions">
                        {canManage && deliveryStatus === "FAILED" ? (
                          <DeliveryRetryButton path={`/api/admin/notifications/deliveries/${text(row, "id")}/retry`} />
                        ) : null}
                        <ViewLink href={`/notifications/${text(row, "id")}`} />
                      </span>
                    );
                  },
                },
              ]}
              rows={rows}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No notification deliveries" description="Failed or pending deliveries will show up here." />}
            />
            <PageNav page={data.page ?? page} size={data.size ?? size} total={total} hrefFor={hrefFor} />
          </>
        )}
      </section>
    </OpsShell>
  );
}
