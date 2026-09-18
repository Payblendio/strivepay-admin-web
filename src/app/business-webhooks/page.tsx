import type { Metadata } from "next";
import Link from "next/link";
import { DeliveryRetryButton } from "@/components/delivery-retry-button";
import { OpsShell } from "@/components/ops-shell";
import { PageNav } from "@/components/page-nav";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import type { AdminPage } from "@/lib/admin-types";
import { asRecord, formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Business webhooks" };

type Search = Promise<{ status?: string | string[]; page?: string | string[] }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function BusinessWebhooksPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const status = first(params.status);
  const page = Math.max(0, Number(first(params.page) || 0) || 0);
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.webhooksView, "/business-webhooks");
  const canManage = hasPermission(principal.permissions, PERMISSIONS.webhooksManage);
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) query.set("status", status);
  const response = await adminBackend(token, `/v1/admin/business-webhooks/deliveries?${query}`);
  const loadOk = response.ok;
  const data = loadOk ? await responseBody(response) as AdminPage : { page, size, total: 0, items: [] };
  const rows = (data.items ?? []).map(asRecord);

  function hrefFor(nextPage: number) {
    const next = new URLSearchParams();
    if (status) next.set("status", status);
    if (nextPage > 0) next.set("page", String(nextPage));
    const search = next.toString();
    return search ? `/business-webhooks?${search}` : "/business-webhooks";
  }

  return (
    <OpsShell
      principal={principal}
      eyebrow="Platform"
      title="Business webhooks"
      copy="Outbound merchant webhook deliveries and retries."
    >
      <form className="ops-toolbar" method="get">
        <label className="sp-field">
          <span>Status</span>
          <select name="status" defaultValue={status}>
            <option value="">Any status</option>
            <option value="PENDING">PENDING</option>
            <option value="FAILED">FAILED</option>
            <option value="DEAD">DEAD</option>
            <option value="DELIVERED">DELIVERED</option>
          </select>
        </label>
        <button className="sp-button primary medium" type="submit">Filter</button>
      </form>

      <section className="ops-panel">
        {!loadOk ? (
          <EmptyState compact title="Business webhooks unavailable" description="Deliveries could not be loaded." />
        ) : (
          <>
            <DataTable
              columns={[
                { key: "url", header: "URL", render: (row) => text(row, "url") },
                {
                  key: "party",
                  header: "Party",
                  render: (row) => {
                    const partyId = text(row, "party_id", "partyId");
                    return partyId === "—"
                      ? "—"
                      : <Link className="ops-link" href={`/customers/${partyId}`}>{partyId.slice(0, 8)}…</Link>;
                  },
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge>,
                },
                { key: "attempts", header: "Attempts", render: (row) => text(row, "attempt_count", "attemptCount") },
                { key: "response", header: "HTTP", render: (row) => text(row, "response_status", "responseStatus") },
                { key: "error", header: "Last error", render: (row) => text(row, "last_error", "lastError") },
                { key: "created", header: "Created", render: (row) => formatInstant(row.created_at ?? row.createdAt) },
                {
                  key: "retry",
                  header: "",
                  render: (row) => {
                    const deliveryStatus = text(row, "status").toUpperCase();
                    if (!canManage || (deliveryStatus !== "FAILED" && deliveryStatus !== "DEAD")) return null;
                    return <DeliveryRetryButton path={`/api/admin/business-webhooks/deliveries/${text(row, "id")}/retry`} />;
                  },
                },
              ]}
              rows={rows}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No business webhook deliveries" description="Outbound merchant deliveries appear here." />}
            />
            <PageNav page={data.page ?? page} size={data.size ?? size} total={data.total ?? 0} hrefFor={hrefFor} />
          </>
        )}
      </section>
    </OpsShell>
  );
}
