import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconListDetails, IconWallet } from "@tabler/icons-react";
import { CurrencyCodeMark, CurrencyPairClip } from "@/components/currency-pair-clip";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { OpsShell } from "@/components/ops-shell";
import { PageNav } from "@/components/page-nav";
import { ViewLink } from "@/components/view-link";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { loadPage } from "@/lib/admin-load";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, formatAmount, formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Pay-in account" };

type Search = Promise<{ page?: string | string[] }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function PayInAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Search;
}) {
  const { id } = await params;
  const page = Math.max(0, Number(first((await searchParams).page) || 0) || 0);
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.customersView, `/pay-in-accounts/${id}`);

  const response = await adminBackend(token, `/v1/admin/pay-in-accounts/${id}`);
  if (response.status === 400 || response.status === 404) notFound();
  if (!response.ok) {
    return (
      <OpsShell principal={principal} eyebrow="Collection rails" title="Pay-in account" copy={id}>
        <EmptyState title="Pay-in account unavailable" description="This account could not be loaded. Refresh and try again." />
      </OpsShell>
    );
  }
  const row = asRecord(await responseBody(response));
  if (!text(row, "id") || text(row, "id") === "—") notFound();

  const txResponse = await adminBackend(token, `/v1/admin/pay-in-accounts/${id}/transactions?page=${page}&size=${size}`);
  const txLoad = await loadPage(txResponse, { page, size });
  const txRows = txLoad.rows;
  const txData = txLoad.data;

  const owner = text(row, "owner_name", "ownerName");
  const email = text(row, "owner_email", "ownerEmail");
  const partyId = text(row, "party_id", "partyId");
  const status = text(row, "status");
  const currency = text(row, "currency_code", "currencyCode");
  const title = text(row, "account_name", "accountName");
  const mask = text(row, "account_mask", "accountMask");
  const displayTitle = title !== "—"
    ? title
    : mask !== "—"
      ? `${text(row, "provider")} ${mask}`
      : `${text(row, "provider")} pay-in`;

  function hrefFor(nextPage: number) {
    return nextPage > 0 ? `/pay-in-accounts/${id}?page=${nextPage}` : `/pay-in-accounts/${id}`;
  }

  return (
    <OpsShell principal={principal} eyebrow="Collection rails" title={displayTitle} copy={email === "—" ? owner : email}>
      <OpsDetailShell
        backHref="/pay-in-accounts"
        backLabel="Back to pay-in accounts"
        defaultTab="overview"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconWallet size={20} />}
            title={displayTitle}
            status={<Badge tone={toneForStatus(status)} dot>{status}</Badge>}
            subtitle={id}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Owner", value: owner },
              { label: "Provider", value: text(row, "provider") },
              { label: "Currency", value: <CurrencyCodeMark code={currency} /> },
              { label: "Transactions", value: String(txData.total ?? txRows.length) },
            ]}
          />
        )}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: <IconWallet size={16} />,
            content: (
              <OpsDetailSection title="Pay-in account" kicker="Overview">
                <OpsDetailFacts
                  items={[
                    { label: "Account id", value: text(row, "id") },
                    {
                      label: "Owner",
                      value: partyId !== "—" ? (
                        <Link className="ops-link" href={`/customers/${partyId}`}>
                          {owner !== "—" ? owner : partyId}
                          {email !== "—" ? ` · ${email}` : ""}
                        </Link>
                      ) : owner,
                    },
                    { label: "Party type", value: text(row, "party_type", "partyType") },
                    { label: "Provider", value: text(row, "provider") },
                    { label: "Kind", value: text(row, "account_kind", "accountKind") },
                    { label: "Currency", value: <CurrencyCodeMark code={currency} /> },
                    { label: "Account name", value: title },
                    { label: "Mask / number", value: text(row, "account_mask", "accountMask") },
                    { label: "Bank / code", value: text(row, "bank_name", "bankName") },
                    { label: "Provider account", value: text(row, "provider_account_id", "providerAccountId") },
                    { label: "Status", value: <Badge tone={toneForStatus(status)} dot>{status}</Badge> },
                    { label: "Created", value: formatInstant(row.created_at ?? row.createdAt) },
                    { label: "Updated", value: formatInstant(row.updated_at ?? row.updatedAt) },
                  ]}
                />
              </OpsDetailSection>
            ),
          },
          {
            id: "transactions",
            label: "Transactions",
            icon: <IconListDetails size={16} />,
            content: (
              <OpsDetailSection title="Related transactions" kicker="Pay-in">
                {!txLoad.ok ? (
                  <EmptyState compact title="Transactions unavailable" description={txLoad.error} />
                ) : (
                  <>
                    <DataTable
                      columns={[
                        {
                          key: "id",
                          header: "Transaction",
                          render: (tx) => {
                            const txId = text(tx, "id");
                            const provider = text(tx, "provider");
                            return (
                              <span className="ops-tx-lead">
                                <CurrencyPairClip
                                  from={text(tx, "source_asset", "sourceAsset")}
                                  to={text(tx, "destination_asset", "destinationAsset")}
                                  size="sm"
                                />
                                {provider === "NGN" ? (
                                  <span title="NGN automatic conversions are not on the book transactions desk">{txId.slice(0, 8)}…</span>
                                ) : (
                                  <Link className="ops-link" href={`/transactions/${txId}`}>{txId.slice(0, 8)}…</Link>
                                )}
                              </span>
                            );
                          },
                        },
                        { key: "provider", header: "Provider", render: (tx) => text(tx, "provider") },
                        { key: "type", header: "Type", render: (tx) => text(tx, "transaction_type", "transactionType") },
                        {
                          key: "status",
                          header: "Status",
                          render: (tx) => <Badge tone={toneForStatus(text(tx, "status"))} dot>{text(tx, "status")}</Badge>,
                        },
                        {
                          key: "route",
                          header: "Route",
                          render: (tx) => `${formatAmount(tx.source_amount ?? tx.sourceAmount, tx.source_asset ?? tx.sourceAsset)} → ${formatAmount(tx.destination_amount ?? tx.destinationAmount, tx.destination_asset ?? tx.destinationAsset)}`,
                        },
                        {
                          key: "details",
                          header: "",
                          render: (tx) => text(tx, "provider") === "NGN"
                            ? null
                            : <ViewLink href={`/transactions/${text(tx, "id")}`} />,
                        },
                        { key: "updated", header: "Updated", render: (tx) => formatInstant(tx.updated_at ?? tx.updatedAt) },
                      ]}
                      rows={txRows}
                      getKey={(tx) => text(tx, "id")}
                      empty={<EmptyState compact title="No related transactions" description="Activity linked to this pay-in account will show here." />}
                    />
                    <PageNav page={txData.page ?? page} size={txData.size ?? size} total={txData.total ?? 0} hrefFor={hrefFor} />
                  </>
                )}
              </OpsDetailSection>
            ),
          },
        ]}
      />
    </OpsShell>
  );
}
