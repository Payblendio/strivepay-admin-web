import type { Metadata } from "next";
import Link from "next/link";
import { CurrencyCodeMark } from "@/components/currency-pair-clip";
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

export const metadata: Metadata = { title: "Pay-in accounts" };

type Search = Promise<{ q?: string | string[]; status?: string | string[]; partyId?: string | string[]; page?: string | string[] }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function PayInAccountsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const q = first(params.q);
  const status = first(params.status);
  const partyId = first(params.partyId);
  const page = Math.max(0, Number(first(params.page) || 0) || 0);
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.customersView, "/pay-in-accounts");

  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  if (partyId) query.set("partyId", partyId);

  const response = await adminBackend(token, `/v1/admin/pay-in-accounts?${query}`);
  const load = await loadPage(response, { page, size });
  const rows = load.rows;
  const data = load.data;

  function hrefFor(nextPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (partyId) next.set("partyId", partyId);
    if (nextPage > 0) next.set("page", String(nextPage));
    const search = next.toString();
    return search ? `/pay-in-accounts?${search}` : "/pay-in-accounts";
  }

  return (
    <OpsShell
      principal={principal}
      eyebrow="Collection rails"
      title="Pay-in accounts"
      copy="Managed funding and NGN collection accounts used to receive customer deposits."
    >
      <form className="ops-toolbar" method="get">
        <label className="sp-field">
          <span>Search</span>
          <input type="search" name="q" defaultValue={q} placeholder="Owner name, party UUID, mask, or account id" />
        </label>
        <label className="sp-field">
          <span>Status</span>
          <select name="status" defaultValue={status}>
            <option value="">Any status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PENDING">PENDING</option>
            <option value="DISABLED">DISABLED</option>
          </select>
        </label>
        <label className="sp-field">
          <span>Party</span>
          <input type="search" name="partyId" defaultValue={partyId} placeholder="Exact party UUID" autoComplete="off" />
        </label>
        <button className="sp-button primary medium" type="submit">Filter</button>
      </form>

      <section className="ops-panel">
        {!load.ok ? (
          <EmptyState compact title="Pay-in accounts unavailable" description={load.error} />
        ) : (
          <>
            <DataTable
              columns={[
                {
                  key: "owner",
                  header: "Owner",
                  render: (row) => {
                    const name = text(row, "owner_name", "ownerName");
                    const email = text(row, "owner_email", "ownerEmail");
                    const party = text(row, "party_id", "partyId");
                    return (
                      <Link className="ops-link" href={`/customers/${party}`}>
                        <TablePerson
                          initials={initials(name === "—" ? (email === "—" ? "AC" : email) : name)}
                          title={name === "—" ? (email === "—" ? "Account owner" : email) : name}
                          subtitle={email}
                        />
                      </Link>
                    );
                  },
                },
                { key: "provider", header: "Provider", render: (row) => text(row, "provider") },
                { key: "kind", header: "Kind", render: (row) => text(row, "account_kind", "accountKind") },
                { key: "currency", header: "Currency", render: (row) => <CurrencyCodeMark code={text(row, "currency_code", "currencyCode")} /> },
                { key: "account", header: "Account", render: (row) => text(row, "account_name", "accountName") },
                { key: "mask", header: "Mask", render: (row) => text(row, "account_mask", "accountMask") },
                { key: "bank", header: "Bank", render: (row) => text(row, "bank_name", "bankName") },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge>,
                },
                { key: "updated", header: "Updated", render: (row) => formatInstant(row.updated_at ?? row.updatedAt) },
                {
                  key: "details",
                  header: "",
                  render: (row) => <ViewLink href={`/pay-in-accounts/${text(row, "id")}`} />,
                },
              ]}
              rows={rows}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No pay-in accounts" description="Managed and NGN collection accounts will appear here." />}
            />
            <PageNav page={data.page ?? page} size={data.size ?? size} total={data.total ?? 0} hrefFor={hrefFor} />
          </>
        )}
      </section>
    </OpsShell>
  );
}
