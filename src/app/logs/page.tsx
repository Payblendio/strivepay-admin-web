import type { Metadata } from "next";
import Link from "next/link";
import { OpsShell } from "@/components/ops-shell";
import { PageNav } from "@/components/page-nav";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { loadPage } from "@/lib/admin-load";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { formatInstant, text } from "@/lib/values";

export const metadata: Metadata = { title: "Audit log" };

type Search = Promise<{
  actorType?: string | string[];
  page?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function actorHref(type: string, id: string) {
  if (!id || id === "—") return null;
  if (type === "ADMIN") return `/team/${id}`;
  if (type === "CUSTOMER" || type === "CORPORATE_MEMBER") return `/customers/${id}`;
  return null;
}

export default async function AuditLogsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const actorType = first(params.actorType);
  const page = Math.max(0, Number(first(params.page) || 0) || 0);
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.auditView, "/logs");

  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (actorType) query.set("actorType", actorType);

  const response = await adminBackend(token, `/v1/admin/audit-events?${query}`);
  const load = await loadPage(response, { page, size });
  const rows = load.rows;
  const data = load.data;

  function hrefFor(nextPage: number) {
    const next = new URLSearchParams();
    if (actorType) next.set("actorType", actorType);
    if (nextPage > 0) next.set("page", String(nextPage));
    const search = next.toString();
    return search ? `/logs?${search}` : "/logs";
  }

  return (
    <OpsShell
      principal={principal}
      eyebrow="Audit trail"
      title="Audit log"
      copy="Recorded admin and customer actions across the platform."
    >
      <form className="ops-toolbar" method="get">
        <label className="sp-field">
          <span>Actor type</span>
          <select name="actorType" defaultValue={actorType}>
            <option value="">Any actor</option>
            <option value="ADMIN">ADMIN</option>
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="CORPORATE_MEMBER">CORPORATE_MEMBER</option>
          </select>
        </label>
        <button className="sp-button primary medium" type="submit">Filter</button>
      </form>

      <section className="ops-panel">
        {!load.ok ? (
          <EmptyState compact title="Audit log unavailable" description={load.error} />
        ) : (
          <>
            <DataTable
              columns={[
                { key: "when", header: "When", render: (row) => formatInstant(row.occurred_at ?? row.occurredAt) },
                {
                  key: "actor",
                  header: "Actor",
                  render: (row) => {
                    const type = text(row, "actor_type", "actorType");
                    const id = text(row, "actor_id", "actorId");
                    if (type === "—") return "—";
                    const href = actorHref(type, id);
                    return (
                      <>
                        {type}
                        {id !== "—" ? (
                          <>
                            {" · "}
                            {href ? <Link className="ops-link" href={href}>{id.slice(0, 8)}…</Link> : id.slice(0, 8) + "…"}
                          </>
                        ) : null}
                      </>
                    );
                  },
                },
                { key: "action", header: "Action", render: (row) => text(row, "action") },
                {
                  key: "target",
                  header: "Target",
                  render: (row) => {
                    const type = text(row, "target_type", "targetType");
                    const id = text(row, "target_id", "targetId");
                    return type === "—" ? "—" : `${type}${id !== "—" ? ` · ${id}` : ""}`;
                  },
                },
                { key: "reason", header: "Reason", render: (row) => text(row, "reason") },
              ]}
              rows={rows}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No audit events" description="Admin and customer actions will appear here." />}
            />
            <PageNav page={data.page ?? page} size={data.size ?? size} total={data.total ?? 0} hrefFor={hrefFor} />
          </>
        )}
      </section>
    </OpsShell>
  );
}
