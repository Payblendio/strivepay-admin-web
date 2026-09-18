import type { Metadata } from "next";
import Link from "next/link";
import { CsvExportButton } from "@/components/csv-export-button";
import { CurrencyPairClip } from "@/components/currency-pair-clip";
import { OpsShell } from "@/components/ops-shell";
import { PageNav } from "@/components/page-nav";
import { ViewLink } from "@/components/view-link";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { TransactionRealtimeRefresh } from "@/components/transaction-realtime-refresh";
import { PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import type { AdminPage } from "@/lib/admin-types";
import { asRecord, asString, formatAmount, formatInstant, formatTransactionDirection, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Transactions" };

type Search = Promise<{
  provider?: string | string[];
  status?: string | string[];
  partyId?: string | string[];
  page?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function TransactionsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const provider = first(params.provider);
  const status = first(params.status);
  const partyId = first(params.partyId);
  const page = Math.max(0, Number(first(params.page) || 0) || 0);
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.transactionsView, "/transactions");

  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (provider) query.set("provider", provider);
  if (status) query.set("status", status);
  if (partyId) query.set("partyId", partyId);

  const response = await adminBackend(token, `/v1/admin/transactions?${query}`);
  const payload = await responseBody(response);
  const failed = !response.ok;
  const errorTitle = failed
    ? asString(asRecord(payload).title, "Transactions could not be loaded.")
    : "";
  const data = (!failed && payload ? payload : { page, size, total: 0, items: [] }) as AdminPage;
  const rows = (data.items ?? []).map(asRecord);
  const total = Number(data.total ?? 0) || 0;

  function hrefFor(nextPage: number) {
    const next = new URLSearchParams();
    if (provider) next.set("provider", provider);
    if (status) next.set("status", status);
    if (partyId) next.set("partyId", partyId);
    if (nextPage > 0) next.set("page", String(nextPage));
    const search = next.toString();
    return search ? `/transactions?${search}` : "/transactions";
  }

  return (
    <OpsShell
      principal={principal}
      eyebrow="Conversion rails"
      title="Transactions"
      copy="Provider rails and NGN automatic conversions across the book."
    >
      <TransactionRealtimeRefresh />
      <form className="ops-toolbar" method="get">
        <label className="sp-field">
          <span>Provider</span>
          <select name="provider" defaultValue={provider}>
            <option value="">Any provider</option>
            <option value="BAKKT">Bakkt</option>
            <option value="QUIDAX">Quidax</option>
            <option value="NGN">NGN automatic</option>
          </select>
        </label>
        <label className="sp-field">
          <span>Status</span>
          <select name="status" defaultValue={status}>
            <option value="">Any status</option>
            <option value="AWAITING_MANUAL_LIQUIDITY">AWAITING_MANUAL_LIQUIDITY</option>
            <option value="FUNDS_CLAIMED">FUNDS_CLAIMED</option>
            <option value="WITHDRAWAL_SUBMITTED">WITHDRAWAL_SUBMITTED</option>
            <option value="PROCESS_COMPLETED">PROCESS_COMPLETED</option>
            <option value="SUCCEEDED">SUCCEEDED</option>
            <option value="OUTSIDE_TRANSFER_RECEIVED">OUTSIDE_TRANSFER_RECEIVED</option>
            <option value="OUTSIDE_TRANSFER_APPROVED">OUTSIDE_TRANSFER_APPROVED</option>
            <option value="PENDING">PENDING</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="ON_HOLD">ON_HOLD</option>
            <option value="COMPLIANCE_REVIEW">COMPLIANCE_REVIEW</option>
            <option value="SETTLED">SETTLED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
            <option value="REFUNDED">REFUNDED</option>
            <option value="FAILED">FAILED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>
        <label className="sp-field">
          <span>Party</span>
          <input type="search" name="partyId" defaultValue={partyId} placeholder="Exact party UUID" autoComplete="off" />
        </label>
        <button className="sp-button primary medium" type="submit">Filter</button>
        <CsvExportButton
          filename="transactions.csv"
          headers={["id", "provider", "type", "status", "source", "destination", "platformFee"]}
          rows={rows.map((row) => [
            text(row, "id"),
            text(row, "provider"),
            text(row, "transaction_type", "transactionType"),
            text(row, "status"),
            `${row.source_amount ?? row.sourceAmount ?? ""} ${row.source_asset ?? row.sourceAsset ?? ""}`,
            `${row.destination_amount ?? row.destinationAmount ?? ""} ${row.destination_asset ?? row.destinationAsset ?? ""}`,
            String(row.fee_amount ?? row.feeAmount ?? ""),
          ])}
        />
      </form>

      <section className="ops-panel">
        {failed ? (
          <EmptyState compact title="Transactions unavailable" description={errorTitle} />
        ) : (
          <>
            <div className="ops-panel-heading">
              <div>
                <span>Book</span>
                <h2>{total} transaction{total === 1 ? "" : "s"}</h2>
              </div>
            </div>
            <PageNav page={data.page ?? page} size={size} total={total} hrefFor={hrefFor} />
            <DataTable
              columns={[
                {
                  key: "id",
                  header: "Transaction",
                  render: (row) => {
                    const id = text(row, "id");
                    return (
                      <span className="ops-tx-lead">
                        <CurrencyPairClip
                          from={text(row, "source_asset", "sourceAsset")}
                          to={text(row, "destination_asset", "destinationAsset")}
                          size="sm"
                        />
                        <Link className="ops-link" href={`/transactions/${id}`}>{id.slice(0, 8)}…</Link>
                      </span>
                    );
                  },
                },
                { key: "provider", header: "Provider", render: (row) => text(row, "provider") },
                { key: "type", header: "Type", render: (row) => formatTransactionDirection(text(row, "transaction_type", "transactionType")) },
                { key: "status", header: "Status", render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge> },
                {
                  key: "route",
                  header: "Route",
                  render: (row) => `${formatAmount(row.source_amount ?? row.sourceAmount, row.source_asset ?? row.sourceAsset)} → ${formatAmount(row.destination_amount ?? row.destinationAmount, row.destination_asset ?? row.destinationAsset)}`,
                },
                {
                  key: "fee",
                  header: "Platform fee",
                  render: (row) => {
                    const type = text(row, "transaction_type", "transactionType").toUpperCase();
                    const asset = type === "CRYPTO_TO_FIAT" || type === "CRYPTO_TO_NGN" || type === "SELL" || type === "OFFRAMP"
                      ? (row.destination_asset ?? row.destinationAsset)
                      : (row.source_asset ?? row.sourceAsset ?? row.fee_asset ?? row.feeAsset);
                    return formatAmount(row.fee_amount ?? row.feeAmount, asset);
                  },
                },
                {
                  key: "economics",
                  header: "",
                  render: (row) => <ViewLink href={`/transactions/${text(row, "id")}`} />,
                },
                { key: "updated", header: "Updated", render: (row) => formatInstant(row.updated_at ?? row.updatedAt) },
              ]}
              rows={rows}
              getKey={(row) => text(row, "id")}
              empty={<EmptyState compact title="No transactions" description="No conversion activity matches these filters." />}
            />
            <PageNav page={data.page ?? page} size={size} total={total} hrefFor={hrefFor} />
          </>
        )}
      </section>
    </OpsShell>
  );
}
