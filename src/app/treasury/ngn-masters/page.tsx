import type { Metadata } from "next";
import Link from "next/link";
import { OpsShell } from "@/components/ops-shell";
import { NgnMastersDesk } from "@/components/ngn-masters-desk";
import { EmptyState } from "@/components/ui/status-state";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { text } from "@/lib/values";

export const metadata: Metadata = { title: "NGN master accounts" };

export default async function NgnMastersPage() {
  const { token, principal } = await requireAdmin(PERMISSIONS.treasuryView, "/treasury/ngn-masters");
  const canManage = hasPermission(principal.permissions, PERMISSIONS.treasuryManage);

  const [mastersResponse, configResponse] = await Promise.all([
    adminBackend(token, "/v1/admin/treasury/ngn-masters"),
    adminBackend(token, "/v1/admin/treasury/ngn-masters/config"),
  ]);

  const masters = mastersResponse.ok ? ((await mastersResponse.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
  const config = configResponse.ok
    ? ((await configResponse.json().catch(() => ({}))) as Record<string, unknown>)
    : {};

  return (
    <OpsShell
      principal={principal}
      eyebrow="Liquidity desk"
      title="NGN master accounts"
      copy="Safe Haven settlement masters for VA auto-sweep and sell payouts."
    >
      <p className="ops-copy">
        <Link className="ops-link" href="/treasury">
          ← Back to treasury tasks
        </Link>
      </p>

      {!mastersResponse.ok ? (
        <EmptyState
          title="Master accounts unavailable"
          description="Confirm Safe Haven credentials and that your role includes treasury.view."
        />
      ) : (
        <NgnMastersDesk
          canManage={canManage}
          provider={text(config, "provider") || "DOT"}
          identityDebitAccount={text(config, "identityDebitAccount")}
          safeHavenEnabled={Boolean(config.safeHavenEnabled)}
          canCreateMasters={Boolean(config.canCreateMasters)}
          masters={masters.map((row) => ({
            id: text(row, "id"),
            accountNumber: text(row, "accountNumber", "account_number"),
            accountName: text(row, "accountName", "account_name"),
            accountType: text(row, "accountType", "account_type"),
            suffix: text(row, "suffix"),
            status: text(row, "status"),
            isDefaultSweep: Boolean(row.isDefaultSweep ?? row.is_default_sweep),
            isDefaultPayout: Boolean(row.isDefaultPayout ?? row.is_default_payout),
            balance: (row.balance as number | string | null | undefined) ?? null,
          }))}
        />
      )}
    </OpsShell>
  );
}
