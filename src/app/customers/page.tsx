import type { Metadata } from "next";
import Link from "next/link";
import { OpsShell } from "@/components/ops-shell";
import { PageNav } from "@/components/page-nav";
import { ViewLink } from "@/components/view-link";
import { DataTable, TablePerson } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { loadPage } from "@/lib/admin-load";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { formatInstant, initials, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Customers" };

type Search = Promise<{ q?: string | string[]; status?: string | string[]; page?: string | string[] }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CustomersPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const q = first(params.q);
  const status = first(params.status);
  const page = Math.max(0, Number(first(params.page) || 0) || 0);
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.customersView, "/customers");

  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (q) query.set("q", q);
  if (status) query.set("status", status);

  const response = await adminBackend(token, `/v1/admin/customers?${query}`);
  const load = await loadPage(response, { page, size });
  const rows = load.rows;
  const data = load.data;

  function hrefFor(nextPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (nextPage > 0) next.set("page", String(nextPage));
    const search = next.toString();
    return search ? `/customers?${search}` : "/customers";
  }

  return (
    <OpsShell
      principal={principal}
      eyebrow="Party directory"
      title="Customers"
      copy="Search people and businesses on the platform."
    >
      <form className="ops-toolbar" method="get">
        <label className="sp-field">
          <span>Search</span>
          <input type="search" name="q" defaultValue={q} placeholder="Name, email, or party id" />
        </label>
        <label className="sp-field">
          <span>Status</span>
          <select name="status" defaultValue={status}>
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
            <option value="PENDING">Pending</option>
          </select>
        </label>
        <button className="sp-button primary medium" type="submit">Filter</button>
      </form>

      <section className="ops-panel">
        {!load.ok ? (
          <EmptyState compact title="Customers unavailable" description={load.error} />
        ) : (
          <>
            <DataTable
              columns={[
            {
              key: "customer",
              header: "Customer",
              render: (row) => {
                const name = text(row, "name");
                const partyType = text(row, "party_type", "partyType").toUpperCase();
                const email = text(row, "email");
                const ownerName = text(row, "owner_name", "ownerName");
                const id = text(row, "id");
                const isOrg = partyType === "ORGANIZATION";
                const subtitle = isOrg
                  ? (email !== "—"
                    ? `Owner · ${email}`
                    : ownerName !== "—"
                      ? `Owner · ${ownerName}`
                      : "No owner linked")
                  : email;
                return (
                  <Link className="ops-link" href={`/customers/${id}`}>
                    <TablePerson
                      initials={initials(name === "—" ? (email === "—" ? "OR" : email) : name)}
                      title={name === "—" ? (email === "—" ? "Organization" : email) : name}
                      subtitle={subtitle}
                    />
                  </Link>
                );
              },
            },
            { key: "type", header: "Type", render: (row) => text(row, "party_type", "partyType") },
            {
              key: "members",
              header: "Members",
              render: (row) => {
                const partyType = text(row, "party_type", "partyType").toUpperCase();
                if (partyType !== "ORGANIZATION") return "—";
                const count = row.member_count ?? row.memberCount;
                return count == null ? "—" : String(count);
              },
            },
            { key: "status", header: "Status", render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge> },
                { key: "country", header: "Country", render: (row) => text(row, "country_of_residence", "countryOfResidence") },
                { key: "compliance", header: "Compliance", render: (row) => text(row, "compliance_status", "complianceStatus") },
                { key: "created", header: "Created", render: (row) => formatInstant(row.created_at ?? row.createdAt) },
                {
                  key: "details",
                  header: "",
                  render: (row) => <ViewLink href={`/customers/${text(row, "id")}`} />,
                },
              ]}
              rows={rows}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No customers" description="Try a different search or status." />}
            />
            <PageNav page={data.page ?? page} size={data.size ?? size} total={data.total ?? 0} hrefFor={hrefFor} />
          </>
        )}
      </section>
    </OpsShell>
  );
}
