import type { Metadata } from "next";
import { OpsShell } from "@/components/ops-shell";
import { QuidaxDesk, type QuidaxAccount, type QuidaxWallet } from "@/components/quidax-desk";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, asString, text } from "@/lib/values";

export const metadata: Metadata = { title: "Quidax" };

function mapAccount(row: Record<string, unknown>): QuidaxAccount {
  return {
    id: text(row, "id"),
    sn: text(row, "sn") === "—" ? null : text(row, "sn"),
    email: text(row, "email") === "—" ? null : text(row, "email"),
    displayName: text(row, "displayName", "display_name") === "—" ? null : text(row, "displayName", "display_name"),
    firstName: text(row, "firstName", "first_name") === "—" ? null : text(row, "firstName", "first_name"),
    lastName: text(row, "lastName", "last_name") === "—" ? null : text(row, "lastName", "last_name"),
    reference: text(row, "reference") === "—" ? null : text(row, "reference"),
    parent: Boolean(row.parent),
    createdAt: text(row, "createdAt", "created_at") === "—" ? null : text(row, "createdAt", "created_at"),
    updatedAt: text(row, "updatedAt", "updated_at") === "—" ? null : text(row, "updatedAt", "updated_at"),
  };
}

function mapWallet(row: Record<string, unknown>): QuidaxWallet {
  return {
    id: text(row, "id") === "—" ? null : text(row, "id"),
    currency: text(row, "currency"),
    name: text(row, "name") === "—" ? null : text(row, "name"),
    balance: (row.balance as number | string | null | undefined) ?? null,
    locked: (row.locked as number | string | null | undefined) ?? null,
    convertedBalance: (row.convertedBalance as number | string | null | undefined) ?? (row.converted_balance as number | string | null | undefined) ?? null,
    crypto: Boolean(row.crypto ?? row.is_crypto),
    blockchainEnabled: Boolean(row.blockchainEnabled ?? row.blockchain_enabled),
    defaultNetwork: text(row, "defaultNetwork", "default_network") === "—" ? null : text(row, "defaultNetwork", "default_network"),
    networks: Array.isArray(row.networks) ? row.networks.map(String) : [],
    depositAddress: text(row, "depositAddress", "deposit_address") === "—" ? null : text(row, "depositAddress", "deposit_address"),
    destinationTag: text(row, "destinationTag", "destination_tag") === "—" ? null : text(row, "destinationTag", "destination_tag"),
    updatedAt: text(row, "updatedAt", "updated_at") === "—" ? null : text(row, "updatedAt", "updated_at"),
  };
}

export default async function QuidaxPage() {
  const { token, principal } = await requireAdmin(PERMISSIONS.treasuryView, "/quidax");
  const canManage = hasPermission(principal.permissions, PERMISSIONS.treasuryManage);

  const [envResponse, parentResponse, walletsResponse, accountsResponse] = await Promise.all([
    adminBackend(token, "/v1/admin/provider/quidax/environment"),
    adminBackend(token, "/v1/admin/provider/quidax/parent"),
    adminBackend(token, "/v1/admin/provider/quidax/parent/wallets"),
    adminBackend(token, "/v1/admin/provider/quidax/accounts"),
  ]);

  const [envBody, parentBody, walletsBody, accountsBody] = await Promise.all([
    responseBody(envResponse),
    responseBody(parentResponse),
    responseBody(walletsResponse),
    responseBody(accountsResponse),
  ]);

  const envPayload = asRecord(envBody);
  const failed = !envResponse.ok || !parentResponse.ok || !walletsResponse.ok || !accountsResponse.ok;
  const failureBody = asRecord(
    !envResponse.ok ? envBody : !parentResponse.ok ? parentBody : !walletsResponse.ok ? walletsBody : accountsBody,
  );
  const parentPayload = parentResponse.ok ? asRecord(parentBody) : null;
  const walletsPayload = walletsResponse.ok ? ((walletsBody as unknown[]) ?? []) : [];
  const accountsPayload = accountsResponse.ok ? ((accountsBody as unknown[]) ?? []) : [];
  const errorTitle = failed
    ? asString(failureBody.title, asString(failureBody.detail, "Quidax could not be loaded."))
    : "";

  return (
    <OpsShell
      principal={principal}
      eyebrow="Liquidity desk"
      title="Quidax"
      copy="Parent wallets, sub-accounts, deposit addresses, and parent-balance swaps."
    >
      <QuidaxDesk
        canManage={canManage}
        mode={text(envPayload, "mode") || "UNKNOWN"}
        enabled={Boolean(envPayload.enabled)}
        parent={parentPayload ? mapAccount(parentPayload) : null}
        wallets={walletsPayload.map((row) => mapWallet(asRecord(row)))}
        accounts={accountsPayload.map((row) => mapAccount(asRecord(row)))}
        loadError={failed ? errorTitle : undefined}
      />
    </OpsShell>
  );
}
