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

export const metadata: Metadata = { title: "Quidax account wallet" };

export default async function QuidaxAccountWalletPage({
  params,
}: {
  params: Promise<{ userId: string; currency: string }>;
}) {
  const resolved = await params;
  const userId = decodeURIComponent(resolved.userId).trim();
  const code = decodeURIComponent(resolved.currency).trim().toUpperCase();
  if (!userId || !code) notFound();
  const { token, principal } = await requireAdmin(
    PERMISSIONS.treasuryView,
    `/quidax/accounts/${userId}/wallets/${code}`,
  );

  const [walletResponse, addressesResponse] = await Promise.all([
    adminBackend(token, `/v1/admin/provider/quidax/accounts/${encodeURIComponent(userId)}/wallets/${encodeURIComponent(code)}`),
    adminBackend(token, `/v1/admin/provider/quidax/accounts/${encodeURIComponent(userId)}/wallets/${encodeURIComponent(code)}/addresses`),
  ]);
  if (walletResponse.status === 400 || walletResponse.status === 404) notFound();
  if (!walletResponse.ok) {
    return (
      <OpsShell principal={principal} eyebrow="Liquidity desk" title="Quidax wallet" copy={`${userId} · ${code}`}>
        <EmptyState title="Wallet unavailable" description="This account wallet could not be loaded from Quidax." />
      </OpsShell>
    );
  }

  const wallet = asRecord(await responseBody(walletResponse));
  const addresses = addressesResponse.ok
    ? ((await responseBody(addressesResponse) as unknown[]) ?? []).map(asRecord)
    : [];
  const asset = text(wallet, "currency") || code;

  return (
    <OpsShell principal={principal} eyebrow="Liquidity desk" title="Quidax wallet" copy={`Sub-account · ${asset}`}>
      <OpsDetailShell
        backHref={`/quidax/accounts/${userId}`}
        backLabel="Back to account"
        defaultTab="overview"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconWallet size={22} />}
            title={`${asset} wallet`}
            status={<Badge tone={wallet.crypto ? "info" : "neutral"} dot>{wallet.crypto ? "Crypto" : "Fiat"}</Badge>}
            subtitle={userId}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Available", value: formatAmount(wallet.balance, asset) },
              { label: "Locked", value: formatAmount(wallet.locked, asset) },
              { label: "Addresses", value: String(addresses.length) },
              { label: "Account", value: <Link className="ops-link" href={`/quidax/accounts/${userId}`}>Open account</Link> },
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
                    { label: "Available", value: formatAmount(wallet.balance, asset) },
                    { label: "Locked", value: formatAmount(wallet.locked, asset) },
                    { label: "Deposit address", value: text(wallet, "depositAddress", "deposit_address") },
                    { label: "Destination tag", value: text(wallet, "destinationTag", "destination_tag") },
                    { label: "Default network", value: text(wallet, "defaultNetwork", "default_network") },
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
                  ]}
                  rows={addresses}
                  getKey={(row) => text(row, "id") + text(row, "address")}
                  empty={<EmptyState compact title="No addresses" description="No payment addresses for this wallet." />}
                />
              </OpsDetailSection>
            ),
          },
        ]}
      />
    </OpsShell>
  );
}
