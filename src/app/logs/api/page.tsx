import type { Metadata } from "next";
import Link from "next/link";
import { OpsShell } from "@/components/ops-shell";
import { PageNav } from "@/components/page-nav";
import { ViewLink } from "@/components/view-link";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import type { AdminPage } from "@/lib/admin-types";
import { asRecord, formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "API requests" };

type Search = Promise<{
  direction?: string | string[];
  service?: string | string[];
  responseStatus?: string | string[];
  page?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ApiRequestLogsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const direction = first(params.direction);
  const service = first(params.service);
  const responseStatus = first(params.responseStatus);
  const page = Math.max(0, Number(first(params.page) || 0) || 0);
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.auditView, "/logs/api");

  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (direction) query.set("direction", direction);
  if (service) query.set("service", service);
  if (responseStatus) query.set("responseStatus", responseStatus);

  const response = await adminBackend(token, `/v1/admin/api-request-logs?${query}`);
  const loadOk = response.ok;
  const data = loadOk ? await responseBody(response) as AdminPage : { page, size, total: 0, items: [] };
  const rows = (data.items ?? []).map(asRecord);

  function hrefFor(nextPage: number) {
    const next = new URLSearchParams();
    if (direction) next.set("direction", direction);
    if (service) next.set("service", service);
    if (responseStatus) next.set("responseStatus", responseStatus);
    if (nextPage > 0) next.set("page", String(nextPage));
    const search = next.toString();
    return search ? `/logs/api?${search}` : "/logs/api";
  }

  return (
    <OpsShell
      principal={principal}
      eyebrow="Audit trail"
      title="API requests"
      copy="Inbound and outbound HTTP traffic captured for investigation."
    >
      <form className="ops-toolbar" method="get">
        <label className="sp-field">
          <span>Direction</span>
          <select name="direction" defaultValue={direction}>
            <option value="">Any direction</option>
            <option value="INBOUND">INBOUND</option>
            <option value="OUTBOUND">OUTBOUND</option>
          </select>
        </label>
        <label className="sp-field">
          <span>Service</span>
          <input name="service" defaultValue={service} placeholder="Service code" />
        </label>
        <label className="sp-field">
          <span>Response status</span>
          <input name="responseStatus" defaultValue={responseStatus} placeholder="e.g. 500" inputMode="numeric" />
        </label>
        <button className="sp-button primary medium" type="submit">Filter</button>
      </form>

      <section className="ops-panel">
        {!loadOk ? (
          <EmptyState compact title="API requests unavailable" description="Request logs could not be loaded." />
        ) : (
          <>
            <DataTable
              columns={[
                {
                  key: "id",
                  header: "Request",
                  render: (row) => {
                    const id = text(row, "id");
                    return <Link className="ops-link" href={`/logs/api/${id}`}>{id.slice(0, 8)}…</Link>;
                  },
                },
                { key: "when", header: "When", render: (row) => formatInstant(row.created_at ?? row.createdAt) },
                { key: "direction", header: "Direction", render: (row) => text(row, "direction") },
                { key: "service", header: "Service", render: (row) => text(row, "service_code", "serviceCode") },
                {
                  key: "method",
                  header: "Call",
                  render: (row) => `${text(row, "http_method", "httpMethod")} ${text(row, "request_uri", "requestUri")}`,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => {
                    const status = text(row, "response_status", "responseStatus");
                    const numeric = Number(status);
                    const tone = Number.isFinite(numeric) && numeric >= 500
                      ? "danger"
                      : Number.isFinite(numeric) && numeric >= 400
                        ? "warning"
                        : toneForStatus(Number.isFinite(numeric) && numeric < 400 ? "SUCCESS" : status);
                    return <Badge tone={tone} dot>{status}</Badge>;
                  },
                },
                { key: "duration", header: "Duration", render: (row) => {
                  const ms = text(row, "duration_ms", "durationMs");
                  return ms === "—" ? "—" : `${ms} ms`;
                } },
                {
                  key: "details",
                  header: "",
                  render: (row) => <ViewLink href={`/logs/api/${text(row, "id")}`} />,
                },
              ]}
              rows={rows}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No API requests" description="Request traffic will appear here once captured." />}
            />
            <PageNav page={data.page ?? page} size={data.size ?? size} total={data.total ?? 0} hrefFor={hrefFor} />
          </>
        )}
      </section>
    </OpsShell>
  );
}
