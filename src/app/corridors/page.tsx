import type { Metadata } from "next";
import { CorridorDeskActions } from "@/components/corridor-desk-actions";
import { CoverageSyncButtons } from "@/components/coverage-sync-buttons";
import { OpsShell } from "@/components/ops-shell";
import { PageNav } from "@/components/page-nav";
import { ViewLink } from "@/components/view-link";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { loadList } from "@/lib/admin-load";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { slicePage } from "@/lib/paginate";
import { formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Corridors" };

type Search = Promise<{ page?: string | string[] }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CorridorsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const page = Math.max(0, Number(first(params.page) || 0) || 0);
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.coverageView, "/corridors");
  const canManage = hasPermission(principal.permissions, PERMISSIONS.coverageManage);
  const response = await adminBackend(token, "/v1/admin/corridors");
  const load = await loadList(response);
  const rows = load.rows;
  const paged = slicePage(rows, page, size);
  const corridors = rows.map((row) => ({
    id: text(row, "id"),
    environment: text(row, "environment"),
    direction: text(row, "direction"),
    sourceAsset: text(row, "source_asset", "sourceAsset"),
    destinationAsset: text(row, "destination_asset", "destinationAsset"),
    network: text(row, "network"),
    certificationStatus: text(row, "certification_status", "certificationStatus"),
  }));

  function hrefFor(nextPage: number) {
    return nextPage > 0 ? `/corridors?page=${nextPage}` : "/corridors";
  }

  return (
    <OpsShell
      principal={principal}
      eyebrow="Coverage"
      title="Corridors"
      copy="Settlement corridors, certification, and provider catalog sync."
    >
      {canManage ? (
        <section className="ops-panel">
          <h2>Coverage sync</h2>
          <CoverageSyncButtons canManage={canManage} />
        </section>
      ) : null}

      {canManage ? (
        <section className="ops-panel">
          <h2>Configure</h2>
          <CorridorDeskActions canManage={canManage} corridors={corridors} />
        </section>
      ) : null}

      <section className="ops-panel">
        <h2>Corridors</h2>
        {!load.ok ? (
          <EmptyState compact title="Corridors unavailable" description={load.error} />
        ) : (
          <>
            <PageNav page={paged.page} size={paged.size} total={paged.total} hrefFor={hrefFor} />
            <DataTable
              columns={[
                { key: "env", header: "Environment", render: (row) => text(row, "environment") },
                { key: "direction", header: "Direction", render: (row) => text(row, "direction") },
                { key: "route", header: "Route", render: (row) => `${text(row, "source_asset", "sourceAsset")} → ${text(row, "destination_asset", "destinationAsset")}` },
                { key: "network", header: "Network", render: (row) => text(row, "network") },
                {
                  key: "cert",
                  header: "Certification",
                  render: (row) => <Badge tone={toneForStatus(text(row, "certification_status", "certificationStatus"))} dot>{text(row, "certification_status", "certificationStatus")}</Badge>,
                },
                {
                  key: "enabled",
                  header: "Enabled",
                  render: (row) => {
                    const enabled = row.enabled === true || row.enabled === "true";
                    return <Badge tone={toneForStatus(enabled ? "ACTIVE" : "DISABLED")}>{enabled ? "Yes" : "No"}</Badge>;
                  },
                },
                { key: "updated", header: "Updated", render: (row) => formatInstant(row.updated_at ?? row.updatedAt) },
                {
                  key: "details",
                  header: "",
                  render: (row) => <ViewLink href={`/corridors/${text(row, "id")}`} />,
                },
              ]}
              rows={paged.rows}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No corridors" description="Configure a corridor to open a settlement path." />}
            />
            <PageNav page={paged.page} size={paged.size} total={paged.total} hrefFor={hrefFor} />
          </>
        )}
      </section>
    </OpsShell>
  );
}
