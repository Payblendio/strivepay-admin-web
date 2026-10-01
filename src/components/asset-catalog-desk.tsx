"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AssetLogo } from "@/components/currency-logos";
import { ReasonModal } from "@/components/reason-modal";
import { DataTable } from "@/components/ui/data-table";
import { Badge, Button, SegmentedControl, TextField } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-session";

export type AdminAsset = {
  code: string;
  name: string;
  type: string;
  decimalPlaces: number;
  active: boolean;
  coingeckoId?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  whitepaperUrl?: string | null;
  explorerUrl?: string | null;
  sortOrder: number;
  featured: boolean;
  rails: { provider: string; network: string }[];
};

export type AdminNetwork = {
  code: string;
  name: string;
  nativeAsset?: string | null;
  active: boolean;
  railLabel?: string | null;
  logoUrl?: string | null;
  addressFamily?: string | null;
  addressPlaceholder?: string | null;
  addressHint?: string | null;
  explorerTxUrl?: string | null;
  sortOrder: number;
};

const ADDRESS_FAMILIES = ["EVM", "BITCOIN", "BITCOIN_CASH", "LITECOIN", "DOGE", "DASH", "SOLANA", "TRON", "RIPPLE", "CARDANO", "STELLAR"];

type Editing =
  | { kind: "asset"; value: AdminAsset; toggleOnly: boolean }
  | { kind: "network"; value: AdminNetwork; toggleOnly: boolean };

export function AssetCatalogDesk({ canManage, assets, networks }: { canManage: boolean; assets: AdminAsset[]; networks: AdminNetwork[] }) {
  const router = useRouter();
  const [tab, setTab] = useState("assets");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needle = query.trim().toLowerCase();
  const visibleAssets = useMemo(
    () => assets.filter((a) => !needle || a.code.toLowerCase().includes(needle) || a.name.toLowerCase().includes(needle)),
    [assets, needle],
  );
  const visibleNetworks = useMemo(
    () => networks.filter((n) => !needle || n.code.toLowerCase().includes(needle) || n.name.toLowerCase().includes(needle)),
    [networks, needle],
  );
  const networkName = useMemo(() => new Map(networks.map((n) => [n.code, n.name])), [networks]);

  function open(next: Editing) {
    setError("");
    setEditing(next.toggleOnly ? { ...next, value: { ...next.value, active: !next.value.active } } as Editing : next);
  }

  async function save(reason: string) {
    if (!editing) return;
    setBusy(true);
    setError("");
    const path = editing.kind === "asset" ? `/api/admin/assets/${editing.value.code}` : `/api/admin/networks/${editing.value.code}`;
    const response = await adminFetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editing.value, reason }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { title?: string; detail?: string } | null;
      setError(data?.detail ?? data?.title ?? "Update failed.");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  function patch<K extends keyof AdminAsset & keyof AdminNetwork>(key: K, value: AdminAsset[K]) {
    setEditing((current) => (current ? ({ ...current, value: { ...current.value, [key]: value } } as Editing) : current));
  }
  function patchAsset<K extends keyof AdminAsset>(key: K, value: AdminAsset[K]) {
    setEditing((current) => (current?.kind === "asset" ? { ...current, value: { ...current.value, [key]: value } } : current));
  }
  function patchNetwork<K extends keyof AdminNetwork>(key: K, value: AdminNetwork[K]) {
    setEditing((current) => (current?.kind === "network" ? { ...current, value: { ...current.value, [key]: value } } : current));
  }

  const activeCount = assets.filter((a) => a.active).length;
  const activeNetworks = networks.filter((n) => n.active).length;

  return (
    <>
      <section className="ops-panel">
        <div className="ops-catalog-toolbar">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { value: "assets", label: `Assets (${activeCount}/${assets.length} on)` },
              { value: "networks", label: `Networks (${activeNetworks}/${networks.length} on)` },
            ]}
          />
          <TextField label="Search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Code or name" />
        </div>

        {tab === "assets" ? (
          <DataTable
            columns={[
              {
                key: "asset",
                header: "Asset",
                render: (a) => (
                  <span className="ops-asset-cell">
                    <AssetLogo code={a.code} url={a.logoUrl} size={30} />
                    <span><strong>{a.code}</strong><small>{a.name}</small></span>
                  </span>
                ),
              },
              { key: "type", header: "Type", render: (a) => <Badge>{a.type}</Badge> },
              {
                key: "networks",
                header: "Networks",
                render: (a) => a.rails.length
                  ? <span className="ops-chip-list">{[...new Set(a.rails.map((r) => r.network))].map((code) => <Badge key={code}>{networkName.get(code) ?? code}</Badge>)}</span>
                  : <small>No enabled rails</small>,
              },
              {
                key: "chart",
                header: "Chart",
                render: (a) => a.coingeckoId
                  ? <a href={`https://www.coingecko.com/en/coins/${a.coingeckoId}`} target="_blank" rel="noreferrer">{a.coingeckoId}</a>
                  : <small>Not linked</small>,
              },
              { key: "order", header: "Order", align: "right", render: (a) => a.sortOrder },
              { key: "featured", header: "Featured", render: (a) => (a.featured ? <Badge tone="info">Featured</Badge> : null) },
              { key: "status", header: "Status", render: (a) => <Badge tone={a.active ? "success" : "neutral"} dot>{a.active ? "On" : "Off"}</Badge> },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (a) => canManage ? (
                  <span className="ops-inline-actions">
                    <Button size="small" variant="quiet" onClick={() => open({ kind: "asset", value: a, toggleOnly: false })}>Edit</Button>
                    <Button size="small" variant={a.active ? "danger" : "secondary"} onClick={() => open({ kind: "asset", value: a, toggleOnly: true })}>
                      {a.active ? "Turn off" : "Turn on"}
                    </Button>
                  </span>
                ) : null,
              },
            ]}
            rows={visibleAssets}
            getKey={(a) => a.code}
            empty="No assets match this search."
          />
        ) : (
          <DataTable
            columns={[
              {
                key: "network",
                header: "Network",
                render: (n) => (
                  <span className="ops-asset-cell">
                    <AssetLogo code={n.code} url={n.logoUrl} size={30} />
                    <span><strong>{n.name}</strong><small>{n.code}</small></span>
                  </span>
                ),
              },
              { key: "rail", header: "Rail", render: (n) => n.railLabel ?? "—" },
              { key: "family", header: "Address format", render: (n) => n.addressFamily ?? <small>Not set</small> },
              { key: "explorer", header: "Explorer", render: (n) => (n.explorerTxUrl ? <small>{new URL(n.explorerTxUrl.replace("{txid}", "x")).host}</small> : "—") },
              { key: "order", header: "Order", align: "right", render: (n) => n.sortOrder },
              { key: "status", header: "Status", render: (n) => <Badge tone={n.active ? "success" : "neutral"} dot>{n.active ? "On" : "Off"}</Badge> },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (n) => canManage ? (
                  <span className="ops-inline-actions">
                    <Button size="small" variant="quiet" onClick={() => open({ kind: "network", value: n, toggleOnly: false })}>Edit</Button>
                    <Button size="small" variant={n.active ? "danger" : "secondary"} onClick={() => open({ kind: "network", value: n, toggleOnly: true })}>
                      {n.active ? "Turn off" : "Turn on"}
                    </Button>
                  </span>
                ) : null,
              },
            ]}
            rows={visibleNetworks}
            getKey={(n) => n.code}
            empty="No networks match this search."
          />
        )}
      </section>

      <ReasonModal
        open={editing !== null}
        title={
          !editing ? ""
            : editing.toggleOnly ? `${editing.value.active ? "Turn on" : "Turn off"} ${editing.value.code}`
              : `Edit ${editing.value.code}`
        }
        description={
          editing?.toggleOnly
            ? editing.value.active
              ? "Customers will see it again and can quote, route and order with it."
              : "Customers will no longer see it, and new quotes, routes and orders will be rejected. In-flight orders continue."
            : "Changes apply to web, mobile and admin immediately."
        }
        confirmLabel={editing?.toggleOnly ? (editing.value.active ? "Turn on" : "Turn off") : "Save changes"}
        busy={busy}
        error={error}
        extraFields={editing && !editing.toggleOnly ? (
          <div className="ops-stack">
            <div className="ops-asset-cell">
              <AssetLogo code={editing.value.code} url={editing.value.logoUrl || null} size={48} />
              <span><strong>{editing.value.code}</strong><small>Logos are shown round everywhere.</small></span>
            </div>
            <TextField label="Name" value={editing.value.name} onChange={(event) => patch("name", event.target.value)} required />
            <TextField label="Logo URL (https)" value={editing.value.logoUrl ?? ""} onChange={(event) => patch("logoUrl", event.target.value)} placeholder="https://coin-images.coingecko.com/…" />
            {editing.kind === "asset" ? (
              <>
                <TextField label="CoinGecko id" value={editing.value.coingeckoId ?? ""} onChange={(event) => patchAsset("coingeckoId", event.target.value)} placeholder="bitcoin" hint="Drives the price chart on the asset screen." />
                <label className="sp-field"><span>Description</span>
                  <textarea value={editing.value.description ?? ""} onChange={(event) => patchAsset("description", event.target.value)} rows={4} />
                </label>
                <TextField label="Website" value={editing.value.websiteUrl ?? ""} onChange={(event) => patchAsset("websiteUrl", event.target.value)} />
                <TextField label="Whitepaper" value={editing.value.whitepaperUrl ?? ""} onChange={(event) => patchAsset("whitepaperUrl", event.target.value)} />
                <TextField label="Explorer" value={editing.value.explorerUrl ?? ""} onChange={(event) => patchAsset("explorerUrl", event.target.value)} />
                <label className="ops-check-row">
                  <input type="checkbox" checked={editing.value.featured} onChange={(event) => patchAsset("featured", event.target.checked)} />
                  <span>Featured (shown first on home screens)</span>
                </label>
              </>
            ) : (
              <>
                <TextField label="Rail label" value={editing.value.railLabel ?? ""} onChange={(event) => patchNetwork("railLabel", event.target.value)} placeholder="ERC20" />
                <label className="sp-field"><span>Address format</span>
                  <select value={editing.value.addressFamily ?? ""} onChange={(event) => patchNetwork("addressFamily", event.target.value || null)}>
                    <option value="">Not set</option>
                    {ADDRESS_FAMILIES.map((family) => <option key={family} value={family}>{family}</option>)}
                  </select>
                </label>
                <TextField label="Address placeholder" value={editing.value.addressPlaceholder ?? ""} onChange={(event) => patchNetwork("addressPlaceholder", event.target.value)} />
                <TextField label="Address hint" value={editing.value.addressHint ?? ""} onChange={(event) => patchNetwork("addressHint", event.target.value)} />
                <TextField label="Explorer transaction URL" value={editing.value.explorerTxUrl ?? ""} onChange={(event) => patchNetwork("explorerTxUrl", event.target.value)} placeholder="https://etherscan.io/tx/{txid}" hint="Must contain {txid}." />
              </>
            )}
            <TextField label="Sort order" inputMode="numeric" value={String(editing.value.sortOrder)} onChange={(event) => patch("sortOrder", Number(event.target.value.replace(/\D/g, "")) || 0)} />
            <label className="ops-check-row">
              <input type="checkbox" checked={editing.value.active} onChange={(event) => patch("active", event.target.checked)} />
              <span>On (visible to customers)</span>
            </label>
          </div>
        ) : null}
        onClose={() => { if (!busy) setEditing(null); }}
        onConfirm={(reason) => void save(reason)}
      />
    </>
  );
}
