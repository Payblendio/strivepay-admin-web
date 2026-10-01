import type { Metadata } from "next";
import { AssetCatalogDesk, type AdminAsset, type AdminNetwork } from "@/components/asset-catalog-desk";
import { OpsShell } from "@/components/ops-shell";
import { EmptyState } from "@/components/ui/status-state";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { loadList } from "@/lib/admin-load";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";

export const metadata: Metadata = { title: "Assets" };

export default async function AssetsPage() {
  const { token, principal } = await requireAdmin(PERMISSIONS.assetsView, "/assets");
  const canManage = hasPermission(principal.permissions, PERMISSIONS.assetsManage);
  const [assets, networks] = await Promise.all([
    adminBackend(token, "/v1/admin/assets").then(loadList),
    adminBackend(token, "/v1/admin/networks").then(loadList),
  ]);

  return (
    <OpsShell
      principal={principal}
      eyebrow="Platform"
      title="Assets"
      copy="Supported coins and networks. Switching one off hides it from customers and blocks new quotes, routes and orders."
    >
      {!assets.ok || !networks.ok ? (
        <section className="ops-panel">
          <EmptyState compact title="Catalog unavailable" description={assets.error || networks.error} />
        </section>
      ) : (
        <AssetCatalogDesk
          canManage={canManage}
          assets={assets.rows as unknown as AdminAsset[]}
          networks={networks.rows as unknown as AdminNetwork[]}
        />
      )}
    </OpsShell>
  );
}
