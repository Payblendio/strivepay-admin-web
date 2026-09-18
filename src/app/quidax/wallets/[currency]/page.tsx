import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconCoin, IconMapPin, IconWallet } from "@tabler/icons-react";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { OpsShell } from "@/components/ops-shell";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, formatAmount, text } from "@/lib/values";

export const metadata: Metadata = { title: "Quidax wallet" };

export default async function QuidaxWalletDetailPage({
  params,
}: {
  params: Promise<{ currency: string }>;
}) {
  const { currency } = await params;
  const code = decodeURIComponent(currency).trim().toUpperCase();
  if (!code) notFound();
  const { token, principal } = await requireAdmin(PERMISSIONS.treasuryView, `/quidax/wallets/${code}`);

  const [walletResponse, addressesResponse] = await Promise.all([
    adminBackend(token, `/v1/admin/provider/quidax/parent/wallets/${encodeURIComponent(code)}`),
    adminBackend(token, `/v1/admin/provider/quidax/parent/wallets/${encodeURIComponent(code)}/addresses`),
  ]);
  if (walletResponse.status === 400 || walletResponse.status === 404) notFound();
  if (!walletResponse.ok) {
    return (
      <OpsShell principal={principal} eyebrow="Liquidity desk" title="Quidax wallet" copy={code}>
        <EmptyState title="Wallet unavailable" description="The parent wallet could not be loaded from Quidax." />
      </OpsShell>
    );
  }

  const wallet = asRecord(await responseBody(walletResponse));
  const addresses = addressesResponse.ok
    ? ((await responseBody(addressesResponse) as unknown[]) ?? []).map(asRecord)
    : [];
  const asset = text(wallet, "currency") || code;
  const crypto = Boolean(wallet.crypto);

  return (
    <OpsShell principal={principal} eyebrow="Liquidity desk" title="Quidax wallet" copy={`Parent · ${asset}`}>
      <OpsDetailShell
        backHref="/quidax"
        backLabel="Back to Quidax"
        defaultTab="overview"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconWallet size={22} />}
            title={`${asset} wallet`}
            status={<Badge tone={crypto ? "info" : "neutral"} dot>{crypto ? "Crypto" : "Fiat"}</Badge>}
            subtitle={text(wallet, "id")}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Available", value: formatAmount(wallet.balance, asset) },
              { label: "Locked", value: formatAmount(wallet.locked, asset) },
              { label: "Addresses", value: String(addresses.length) },
              { label: "Network", value: text(wallet, "defaultNetwork", "default_network") },
            ]}
          />
        )}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: <IconCoin size={16} />,
            content: (
              <OpsDetailSection title="Wallet" kicker="Overview">
                <OpsDetailFacts
                  items={[
                    { label: "Currency", value: asset },
                    { label: "Name", value: text(wallet, "name") },
                    { label: "Available", value: formatAmount(wallet.balance, asset) },
                    { label: "Locked", value: formatAmount(wallet.locked, asset) },
                    { label: "Converted", value: formatAmount(wallet.convertedBalance ?? wallet.converted_balance, "NGN") },
                    { label: "Default network", value: text(wallet, "defaultNetwork", "default_network") },
                    {
                      label: "Networks",
                      value: Array.isArray(wallet.networks) && wallet.networks.length
                        ? wallet.networks.map(String).join(", ")
                        : "—",
                    },
                    { label: "Deposit address", value: text(wallet, "depositAddress", "deposit_address") },
                    { label: "Destination tag", value: text(wallet, "destinationTag", "destination_tag") },
                    { label: "Updated", value: text(wallet, "updatedAt", "updated_at") },
                  ]}
                />
              </OpsDetailSection>
            ),
          },
          {
            id: "addresses",
            label: "Addresses",
            icon: <IconMapPin size={16} />,
            content: (
              <OpsDetailSection title="Payment addresses" kicker="Deposit">
                <DataTable
                  columns={[
                    { key: "id", header: "Address id", render: (row) => text(row, "id") },
                    { key: "address", header: "Address", render: (row) => text(row, "address") },
                    { key: "network", header: "Network", render: (row) => text(row, "network") },
                    { key: "tag", header: "Tag / memo", render: (row) => text(row, "destinationTag", "destination_tag") },
                    { key: "created", header: "Created", render: (row) => text(row, "createdAt", "created_at") },
                  ]}
                  rows={addresses}
                  getKey={(row) => text(row, "id") + text(row, "address")}
                  empty={<EmptyState compact title="No addresses" description="Quidax returned no payment addresses for this wallet." />}
                />
                <p className="ops-copy">
                  <Link className="ops-link" href="/quidax">← Back to Quidax tabs</Link>
                </p>
              </OpsDetailSection>
            ),
          },
        ]}
      />
    </OpsShell>
  );
}
