import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconCoin, IconId, IconListDetails, IconRoute } from "@tabler/icons-react";
import { CurrencyPairClip } from "@/components/currency-pair-clip";
import { NgnFulfilmentPanel } from "@/components/ngn-fulfilment-panel";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { OpsShell } from "@/components/ops-shell";
import { TransactionEconomicsPanel } from "@/components/transaction-economics-panel";
import { TransactionRealtimeRefresh } from "@/components/transaction-realtime-refresh";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import type { TransactionEconomics } from "@/lib/admin-types";
import { asRecord, formatAmount, formatInstant, formatTransactionDirection, text, toneForStatus, transactionHeading } from "@/lib/values";

export const metadata: Metadata = { title: "Transaction" };

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, principal } = await requireAdmin(PERMISSIONS.transactionsView, `/transactions/${id}`);
  const canManage = hasPermission(principal.permissions, PERMISSIONS.transactionsManage)
    || hasPermission(principal.permissions, PERMISSIONS.treasuryManage);

  const txResponse = await adminBackend(token, `/v1/admin/transactions/${id}`);
  if (txResponse.status === 400 || txResponse.status === 404) notFound();
  const tx = asRecord(await responseBody(txResponse));
  if (!text(tx, "id") || text(tx, "id") === "—") notFound();

  const provider = text(tx, "provider");
  const isNgn = provider === "NGN";

  const [ledgerResponse, economicsResponse, costsResponse] = await Promise.all([
    isNgn ? Promise.resolve(null) : adminBackend(token, `/v1/admin/transactions/${id}/ledger`),
    isNgn ? Promise.resolve(null) : adminBackend(token, `/v1/admin/transactions/${id}/economics`),
    isNgn ? adminBackend(token, `/v1/admin/automatic-conversions/${id}/costs`) : Promise.resolve(null),
  ]);

  const ledgerOk = Boolean(ledgerResponse?.ok);
  const economicsOk = Boolean(economicsResponse?.ok);
  const costsOk = Boolean(costsResponse?.ok);
  const ledger = ledgerOk && ledgerResponse ? ((await responseBody(ledgerResponse) as unknown[]) ?? []).map(asRecord) : [];
  const economics = economicsOk && economicsResponse ? await responseBody(economicsResponse) as TransactionEconomics : null;
  const costs = costsOk && costsResponse ? ((await responseBody(costsResponse) as unknown[]) ?? []).map(asRecord) : [];
  const status = text(tx, "status");
  const orderId = text(tx, "order_id", "orderId");
  const partyId = text(tx, "party_id", "partyId");
  const profit = economics?.realizedProfit != null ? String(economics.realizedProfit) : "—";
  const fee = economics?.fee
    ? formatAmount(economics.fee.chargedAmount, economics.fee.feeAsset)
    : formatAmount(tx.fee_amount ?? tx.feeAmount, tx.source_asset ?? tx.sourceAsset ?? tx.fee_asset ?? tx.feeAsset);
  const valuation = economics?.valuationStatus ?? "—";
  const nextSteps = Array.isArray(tx.nextSteps) ? tx.nextSteps.map(String) : [];
  const treasuryTask = asRecord(tx.treasuryTask);
  const treasuryTaskId = text(treasuryTask, "id");
  const history = Array.isArray(tx.statusHistory) ? tx.statusHistory.map(asRecord) : [];
  const destinationAsset = text(tx, "destination_asset", "destinationAsset");
  const withdrawal = tx.providerWithdrawal ? asRecord(tx.providerWithdrawal) : null;

  return (
    <OpsShell principal={principal} eyebrow="Conversion rails" title="Transaction" copy={`${provider} · ${status}`}>
      <TransactionRealtimeRefresh />
      <OpsDetailShell
        backHref="/transactions"
        backLabel="Back to transactions"
        defaultTab={isNgn ? "fulfilment" : "overview"}
        headerTitle={(
          <OpsDetailTitle
            icon={(
              <CurrencyPairClip
                from={text(tx, "source_asset", "sourceAsset")}
                to={destinationAsset}
                size="md"
              />
            )}
            title={transactionHeading(tx)}
            status={<Badge tone={toneForStatus(status)} dot>{status}</Badge>}
            subtitle={`${formatTransactionDirection(text(tx, "transaction_type", "transactionType"))} · ${provider} · ${id}`}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Provider", value: provider },
              { label: "Route", value: `${text(tx, "source_asset", "sourceAsset")} → ${destinationAsset}` },
              { label: "Type", value: formatTransactionDirection(text(tx, "transaction_type", "transactionType")) },
              { label: "Status", value: status },
              { label: "Platform fee", value: fee },
              ...(isNgn
                ? [
                    { label: "Quoted crypto", value: formatAmount(tx.quotedDestinationAmount ?? tx.destination_amount ?? tx.destinationAmount, destinationAsset) },
                    { label: "Shortfall", value: treasuryTaskId !== "—" ? formatAmount(treasuryTask.shortfallAmount, text(treasuryTask, "asset") || destinationAsset) : "—" },
                  ]
                : [
                    { label: "Realized profit", value: profit },
                    { label: "Ledger rows", value: String(ledger.length) },
                  ]),
            ]}
          />
        )}
        tabs={[
          ...(isNgn ? [{
            id: "fulfilment",
            label: "Fulfilment",
            icon: <IconRoute size={16} />,
            content: (
              <NgnFulfilmentPanel
                conversionId={id}
                canManage={canManage}
                canResume={Boolean(tx.canResumeLiquidity)}
                canSwap={Boolean(tx.canFulfilWithSwap)}
                canReopen={Boolean(tx.canReopenReview)}
                failureCode={text(tx, "failureCode") === "—" ? null : text(tx, "failureCode")}
                destinationAsset={destinationAsset}
                shortfallAmount={treasuryTask.shortfallAmount as number | string | null | undefined}
                requiredAmount={(treasuryTask.requiredAmount ?? tx.quotedDestinationAmount) as number | string | null | undefined}
                nextSteps={nextSteps}
                treasuryTaskId={treasuryTaskId !== "—" ? treasuryTaskId : null}
              />
            ),
          }] : []),
          {
            id: "overview",
            label: "Overview",
            icon: <IconId size={16} />,
            content: (
              <OpsDetailSection title="Transaction" kicker="Overview">
                <OpsDetailFacts
                  items={[
                    { label: "Transaction id", value: text(tx, "id") },
                    { label: "Order id", value: orderId },
                    {
                      label: "Party",
                      value: partyId !== "—" ? (
                        <Link className="ops-link" href={`/customers/${partyId}`}>{partyId}</Link>
                      ) : "—",
                    },
                    { label: "Provider", value: provider },
                    { label: "Type", value: text(tx, "transaction_type", "transactionType") },
                    { label: "Status", value: <Badge tone={toneForStatus(status)} dot>{status}</Badge> },
                    {
                      label: "Source",
                      value: formatAmount(tx.source_amount ?? tx.sourceAmount, tx.source_asset ?? tx.sourceAsset),
                    },
                    {
                      label: "Destination",
                      value: formatAmount(tx.destination_amount ?? tx.destinationAmount ?? tx.netDestinationAmount ?? tx.quotedDestinationAmount, destinationAsset),
                    },
                    {
                      label: "Platform fee",
                      value: formatAmount(tx.fee_amount ?? tx.feeAmount, tx.source_asset ?? tx.sourceAsset ?? tx.fee_asset ?? tx.feeAsset),
                    },
                    ...(isNgn ? [
                      { label: "Network", value: text(tx, "destinationNetwork") },
                      { label: "Delivery address", value: text(tx, "deliveryAddress") },
                      { label: "Effective rate", value: tx.effectiveRate != null ? String(tx.effectiveRate) : "—" },
                      { label: "Failure code", value: text(tx, "failureCode") },
                      { label: "Provider quote", value: text(tx, "providerQuoteId") },
                      { label: "Provider swap", value: text(tx, "providerSwapId") },
                      { label: "Provider withdrawal", value: text(tx, "providerWithdrawalId") },
                      { label: "Withdrawal fee", value: formatAmount(tx.withdrawalFeeAmount, destinationAsset) },
                      ...(withdrawal ? [
                        { label: "Withdrawal status", value: text(withdrawal, "status") },
                        { label: "Withdrawal amount", value: formatAmount(withdrawal.amount, text(withdrawal, "currency") || destinationAsset) },
                        { label: "Withdrawal network fee", value: formatAmount(withdrawal.fee, text(withdrawal, "currency") || destinationAsset) },
                        { label: "Withdrawal txid", value: text(withdrawal, "txid") },
                        { label: "Withdrawal address", value: text(withdrawal, "address") },
                        { label: "Withdrawal network", value: text(withdrawal, "network") },
                      ] : []),
                    ] : [
                      { label: "Provider transaction", value: text(tx, "provider_transaction_id", "providerTransactionId") },
                      { label: "Provider process", value: text(tx, "provider_process_id", "providerProcessId") },
                    ]),
                    { label: "Created", value: formatInstant(tx.created_at ?? tx.createdAt) },
                    { label: "Updated", value: formatInstant(tx.updated_at ?? tx.updatedAt) },
                  ]}
                />
                {isNgn && history.length ? (
                  <>
                    <h3 className="ops-panel-heading" style={{ marginTop: "1.25rem" }}>Status history</h3>
                    <DataTable
                      columns={[
                        { key: "when", header: "When", render: (row) => formatInstant(row.createdAt) },
                        { key: "status", header: "Status", render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge> },
                        { key: "code", header: "Code", render: (row) => text(row, "failureCode") },
                      ]}
                      rows={history}
                      getKey={(row) => `${text(row, "status")}-${String(row.createdAt ?? "")}`}
                    />
                  </>
                ) : null}
              </OpsDetailSection>
            ),
          },
          {
            id: "economics",
            label: isNgn ? "Costs" : "Economics",
            icon: <IconCoin size={16} />,
            content: (
              <OpsDetailSection title={isNgn ? "Conversion costs" : "Economics"} kicker="Transaction">
                {isNgn ? (
                  !costsOk ? (
                    <EmptyState compact title="Costs unavailable" description="Automatic conversion costs could not be loaded." />
                  ) : (
                    <DataTable
                      columns={[
                        { key: "type", header: "Type", render: (row) => text(row, "type") },
                        { key: "provider", header: "Provider", render: (row) => text(row, "provider") },
                        { key: "amount", header: "Amount", render: (row) => formatAmount(row.actualAmount ?? row.quotedAmount, row.asset) },
                        { key: "valuation", header: "Valuation", render: (row) => formatAmount(row.valuationAmount, row.valuationCurrency) },
                        { key: "status", header: "Status", render: (row) => text(row, "status") },
                      ]}
                      rows={costs}
                      getKey={(row) => text(row, "id")}
                      empty={<EmptyState compact title="No costs yet" description="Provider and treasury costs appear here as the conversion advances." />}
                    />
                  )
                ) : !economicsOk ? (
                  <EmptyState compact title="Economics unavailable" description="Economics could not be loaded for this transaction." />
                ) : (
                  <>
                    <p className="ops-panel-copy" style={{ marginBottom: "1rem" }}>
                      Valuation {valuation !== "—" ? <Badge tone="info">{valuation}</Badge> : "unavailable"}
                      {orderId !== "—" ? ` · order ${orderId}` : ""}
                    </p>
                    <TransactionEconomicsPanel
                      transactionId={id}
                      initial={economics}
                      canManage={hasPermission(principal.permissions, PERMISSIONS.transactionsManage)}
                    />
                  </>
                )}
              </OpsDetailSection>
            ),
          },
          ...(!isNgn ? [{
            id: "ledger",
            label: "Ledger",
            icon: <IconListDetails size={16} />,
            content: (
              <OpsDetailSection title="Ledger postings" kicker="Transaction">
                {!ledgerOk ? (
                  <EmptyState compact title="Ledger unavailable" description="Ledger postings could not be loaded for this transaction." />
                ) : (
                  <DataTable
                    columns={[
                      { key: "when", header: "When", render: (row) => formatInstant(row.created_at ?? row.createdAt) },
                      { key: "event", header: "Event", render: (row) => text(row, "event_type", "eventType") },
                      { key: "account", header: "Account", render: (row) => text(row, "account_code", "accountCode") },
                      { key: "direction", header: "Direction", render: (row) => <Badge tone="info">{text(row, "direction")}</Badge> },
                      { key: "amount", header: "Amount", render: (row) => formatAmount(row.amount, row.asset_code ?? row.assetCode) },
                      { key: "description", header: "Description", render: (row) => text(row, "description") },
                    ]}
                    rows={ledger}
                    getKey={(row) => text(row, "posting_id", "postingId") || `${text(row, "journal_id", "journalId")}-${text(row, "account_code", "accountCode")}`}
                    empty={<EmptyState compact title="No ledger postings" description="This transaction may not be linked to an order record yet." />}
                  />
                )}
              </OpsDetailSection>
            ),
          }] : []),
        ]}
      />
    </OpsShell>
  );
}
