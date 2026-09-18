import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconCoin, IconId, IconWallet } from "@tabler/icons-react";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { OpsShell } from "@/components/ops-shell";
import { ViewLink } from "@/components/view-link";
import { DataTable, TablePerson } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, formatAmount, text } from "@/lib/values";

export const metadata: Metadata = { title: "Quidax account" };

export default async function QuidaxAccountDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const id = decodeURIComponent(userId).trim();
  if (!id) notFound();
  const { token, principal } = await requireAdmin(PERMISSIONS.treasuryView, `/quidax/accounts/${id}`);

  const [accountResponse, walletsResponse] = await Promise.all([
    adminBackend(token, `/v1/admin/provider/quidax/accounts/${encodeURIComponent(id)}`),
    adminBackend(token, `/v1/admin/provider/quidax/accounts/${encodeURIComponent(id)}/wallets`),
  ]);
  if (accountResponse.status === 400 || accountResponse.status === 404) notFound();
  if (!accountResponse.ok) {
    return (
      <OpsShell principal={principal} eyebrow="Liquidity desk" title="Quidax account" copy={id}>
        <EmptyState title="Account unavailable" description="This Quidax sub-account could not be loaded." />
      </OpsShell>
    );
  }

  const account = asRecord(await responseBody(accountResponse));
  const wallets = walletsResponse.ok
    ? ((await responseBody(walletsResponse) as unknown[]) ?? []).map(asRecord)
    : [];
  const name = text(account, "displayName", "display_name") !== "—"
    ? text(account, "displayName", "display_name")
    : [text(account, "firstName", "first_name"), text(account, "lastName", "last_name")].filter((v) => v && v !== "—").join(" ") || text(account, "email");

  return (
    <OpsShell principal={principal} eyebrow="Liquidity desk" title="Quidax account" copy={text(account, "email")}>
      <OpsDetailShell
        backHref="/quidax"
        backLabel="Back to Quidax"
        defaultTab="overview"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconId size={22} />}
            title={name}
            status={<Badge tone={account.parent ? "info" : "neutral"} dot>{account.parent ? "Parent" : "Sub-account"}</Badge>}
            subtitle={text(account, "id")}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "SN", value: text(account, "sn") },
              { label: "Email", value: text(account, "email") },
              { label: "Wallets", value: String(wallets.length) },
              { label: "Reference", value: text(account, "reference") },
            ]}
          />
        )}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: <IconId size={16} />,
            content: (
              <OpsDetailSection title="Account" kicker="Overview">
                <OpsDetailFacts
                  items={[
                    { label: "User id", value: text(account, "id") },
                    { label: "SN", value: text(account, "sn") },
                    { label: "Email", value: text(account, "email") },
                    { label: "Display name", value: name },
                    { label: "First name", value: text(account, "firstName", "first_name") },
                    { label: "Last name", value: text(account, "lastName", "last_name") },
                    { label: "Reference", value: text(account, "reference") },
                    { label: "Created", value: text(account, "createdAt", "created_at") },
                    { label: "Updated", value: text(account, "updatedAt", "updated_at") },
                  ]}
                />
              </OpsDetailSection>
            ),
          },
          {
            id: "wallets",
            label: "Wallets",
            icon: <IconWallet size={16} />,
            content: (
              <OpsDetailSection title="Wallets & addresses" kicker="Balances">
                <DataTable
                  columns={[
                    {
                      key: "currency",
                      header: "Asset",
                      render: (row) => (
                        <TablePerson
                          title={text(row, "currency")}
                          subtitle={row.crypto ? "Crypto" : "Fiat"}
                          initials={text(row, "currency").slice(0, 2)}
                        />
                      ),
                    },
                    {
                      key: "balance",
                      header: "Available",
                      render: (row) => formatAmount(row.balance, text(row, "currency")),
                    },
                    {
                      key: "locked",
                      header: "Locked",
                      render: (row) => formatAmount(row.locked, text(row, "currency")),
                    },
                    {
                      key: "deposit",
                      header: "Deposit address",
                      render: (row) => text(row, "depositAddress", "deposit_address"),
                    },
                    {
                      key: "network",
                      header: "Network",
                      render: (row) => text(row, "defaultNetwork", "default_network"),
                    },
                    {
                      key: "actions",
                      header: "",
                      render: (row) => (
                        <ViewLink href={`/quidax/accounts/${id}/wallets/${encodeURIComponent(text(row, "currency"))}`} />
                      ),
                    },
                  ]}
                  rows={wallets}
                  getKey={(row) => text(row, "id") + text(row, "currency")}
                  empty={<EmptyState compact title="No wallets" description="Quidax returned no wallets for this account." />}
                />
                <p className="ops-copy">
                  <Link className="ops-link" href="/quidax">← Back to Quidax tabs</Link>
                </p>
              </OpsDetailSection>
            ),
          },
          {
            id: "parent",
            label: "Parent link",
            icon: <IconCoin size={16} />,
            content: (
              <OpsDetailSection title="Liquidity context" kicker="Parent">
                <OpsDetailFacts
                  items={[
                    { label: "Open parent desk", value: <Link className="ops-link" href="/quidax">Quidax management</Link> },
                    { label: "Parent wallets", value: <Link className="ops-link" href="/quidax">View funded balances</Link> },
                    { label: "Parent swap", value: <Link className="ops-link" href="/quidax">NGN → crypto desk</Link> },
                  ]}
                />
              </OpsDetailSection>
            ),
          },
        ]}
      />
    </OpsShell>
  );
}
