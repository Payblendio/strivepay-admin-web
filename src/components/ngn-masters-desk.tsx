"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, TextField } from "@/components/ui/primitives";
import { DataTable, TablePerson } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/status-state";
import { adminFetch } from "@/lib/admin-session";
import { promptReason } from "@/lib/swal";
import { formatAmount } from "@/lib/values";

type Master = {
  id: string;
  accountNumber?: string;
  accountName?: string;
  accountType?: string;
  suffix?: string;
  status?: string;
  isDefaultSweep?: boolean;
  isDefaultPayout?: boolean;
  balance?: number | string | null;
};

type ProviderAccount = {
  providerAccountId: string;
  accountNumber?: string;
  accountName?: string;
  accountType?: string;
  status?: string;
  registered?: boolean;
  balance?: number | string | null;
};

const SUFFIX_PRESETS = ["SETTLEMENT", "SWEEP", "PAYOUT"] as const;

function errorMessage(data: { title?: string; detail?: string } | null, fallback: string) {
  return data?.detail || data?.title || fallback;
}

function accountInitials(name?: string, number?: string) {
  const source = (name || number || "NG").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function roleLabels(row: Pick<Master, "isDefaultSweep" | "isDefaultPayout">) {
  const roles: string[] = [];
  if (row.isDefaultSweep) roles.push("Sweep");
  if (row.isDefaultPayout) roles.push("Payout");
  return roles;
}

export function NgnMastersDesk({
  canManage,
  masters,
  identityDebitAccount,
  provider,
  safeHavenEnabled,
  canCreateMasters,
}: {
  canManage: boolean;
  masters: Master[];
  identityDebitAccount: string;
  provider: string;
  safeHavenEnabled: boolean;
  canCreateMasters: boolean;
}) {
  const router = useRouter();
  const [accountType, setAccountType] = useState("Current");
  const [suffix, setSuffix] = useState("SETTLEMENT");
  const [defaultSweep, setDefaultSweep] = useState(masters.length === 0);
  const [defaultPayout, setDefaultPayout] = useState(masters.length === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [providerAccounts, setProviderAccounts] = useState<ProviderAccount[] | null>(null);
  const [loadingProviderAccounts, setLoadingProviderAccounts] = useState(false);

  const ready = provider === "SAFEHAVEN" && safeHavenEnabled && canCreateMasters;
  const hasSweepDefault = masters.some((row) => row.isDefaultSweep && row.status === "ACTIVE");
  const hasPayoutDefault = masters.some((row) => row.isDefaultPayout && row.status === "ACTIVE");

  async function createMaster() {
    if (!canManage || !canCreateMasters) return;
    const reason = await promptReason({
      title: "Create Safe Haven master",
      text: "Creates a Safe Haven Current/Savings account under your IBS profile and registers it as an NGN master.",
      confirmLabel: "Create account",
    });
    if (!reason) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await adminFetch("/api/admin/treasury/ngn-masters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType, suffix: suffix.trim(), reason, defaultSweep, defaultPayout }),
      });
      const data = (await response.json().catch(() => null)) as { title?: string; detail?: string; accountNumber?: string } | null;
      if (!response.ok) {
        setError(errorMessage(data, "Could not create master account."));
        return;
      }
      setMessage(`Created ${data?.accountNumber ?? "master account"}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function loadProviderAccounts() {
    setLoadingProviderAccounts(true);
    setError("");
    setMessage("");
    try {
      const response = await adminFetch("/api/admin/treasury/ngn-masters/provider-accounts");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessage(data, "Could not load Safe Haven accounts."));
        setProviderAccounts([]);
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      setProviderAccounts(
        rows.map((row: Record<string, unknown>) => ({
          providerAccountId: String(row.providerAccountId ?? row.provider_account_id ?? ""),
          accountNumber: String(row.accountNumber ?? row.account_number ?? ""),
          accountName: String(row.accountName ?? row.account_name ?? ""),
          accountType: String(row.accountType ?? row.account_type ?? ""),
          status: String(row.status ?? ""),
          registered: String(row.suffix ?? "") === "REGISTERED",
          balance: (row.balance as number | string | null | undefined) ?? null,
        })),
      );
    } finally {
      setLoadingProviderAccounts(false);
    }
  }

  async function importMaster(providerAccountId: string) {
    if (!canManage || !canCreateMasters || !providerAccountId) return;
    const reason = await promptReason({
      title: "Import Safe Haven account",
      text: "Registers an existing Safe Haven account as an NGN master without creating a new one.",
      confirmLabel: "Import account",
    });
    if (!reason) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await adminFetch("/api/admin/treasury/ngn-masters/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerAccountId, reason, defaultSweep, defaultPayout }),
      });
      const data = (await response.json().catch(() => null)) as { title?: string; detail?: string; accountNumber?: string } | null;
      if (!response.ok) {
        setError(errorMessage(data, "Could not import master account."));
        return;
      }
      setMessage(`Imported ${data?.accountNumber ?? "master account"}.`);
      setProviderAccounts(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "default-sweep" | "default-payout" | "disable" | "refresh-balance", title: string) {
    if (action !== "refresh-balance" && !canManage) return;
    let reason = "Refresh balance";
    if (action !== "refresh-balance") {
      const next = await promptReason({ title, text: "This change is audited against your admin account.", confirmLabel: "Confirm" });
      if (!next) return;
      reason = next;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await adminFetch(`/api/admin/treasury/ngn-masters/${id}/${action}`, {
        method: "POST",
        headers: action === "refresh-balance" ? undefined : { "Content-Type": "application/json" },
        body: action === "refresh-balance" ? undefined : JSON.stringify({ reason }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessage(data, "Master account action failed."));
        return;
      }
      setMessage(action === "refresh-balance" ? "Balance refreshed." : "Master account updated.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ops-stack ngn-masters-desk">
      <div className="ops-metrics">
        <div className={`ops-metric ${provider === "SAFEHAVEN" ? "ready" : "not-ready"}`}>
          <span>Provider</span>
          <strong>{provider}</strong>
        </div>
        <div className={`ops-metric ${safeHavenEnabled ? "ready" : "not-ready"}`}>
          <span>Credentials</span>
          <strong>{safeHavenEnabled ? "Ready" : "Missing"}</strong>
        </div>
        <div className={`ops-metric ${identityDebitAccount ? "ready" : "not-ready"}`}>
          <span>Identity debit</span>
          <strong>{identityDebitAccount || "—"}</strong>
        </div>
        <div className={`ops-metric ${hasSweepDefault && hasPayoutDefault ? "ready" : "not-ready"}`}>
          <span>Defaults</span>
          <strong>
            {hasSweepDefault ? "Sweep" : "No sweep"}
            {" · "}
            {hasPayoutDefault ? "Payout" : "No payout"}
          </strong>
        </div>
      </div>

      {!ready ? (
        <p className="ops-inline-error">
          Set `STRIVEPAY_NGN_BANK_PROVIDER=SAFEHAVEN` and Safe Haven credentials on api/worker, then restart containers.
        </p>
      ) : null}
      {error ? <p className="ops-inline-error">{error}</p> : null}
      {message ? <p className="ops-inline-success">{message}</p> : null}

      <section className="ops-panel">
        <div className="ops-panel-heading">
          <div>
            <span>Masters on file</span>
            <h2>Master accounts</h2>
          </div>
        </div>
        <DataTable
          columns={[
            {
              key: "account",
              header: "Account",
              render: (row: Master) => (
                <TablePerson
                  initials={accountInitials(row.accountName, row.accountNumber)}
                  title={row.accountNumber || "—"}
                  subtitle={row.accountName || row.suffix || "Safe Haven master"}
                />
              ),
            },
            {
              key: "type",
              header: "Type",
              render: (row: Master) => row.accountType || "—",
            },
            {
              key: "roles",
              header: "Roles",
              render: (row: Master) => {
                const roles = roleLabels(row);
                if (!roles.length) return "—";
                return (
                  <span className="ngn-role-list">
                    {roles.map((role) => (
                      <span key={role} className="ngn-role-chip">
                        {role}
                      </span>
                    ))}
                  </span>
                );
              },
            },
            {
              key: "balance",
              header: "Balance",
              align: "right",
              render: (row: Master) => formatAmount(row.balance, "NGN"),
            },
            {
              key: "status",
              header: "Status",
              render: (row: Master) => row.status || "—",
            },
            {
              key: "actions",
              header: "Actions",
              render: (row: Master) => (
                <div className="ops-inline-actions">
                  <Button variant="secondary" disabled={busy} onClick={() => void act(row.id, "refresh-balance", "Refresh")}>
                    Refresh
                  </Button>
                  {canManage && row.status === "ACTIVE" ? (
                    <>
                      {!row.isDefaultSweep ? (
                        <Button variant="secondary" disabled={busy} onClick={() => void act(row.id, "default-sweep", "Make sweep default")}>
                          Sweep
                        </Button>
                      ) : null}
                      {!row.isDefaultPayout ? (
                        <Button variant="secondary" disabled={busy} onClick={() => void act(row.id, "default-payout", "Make payout default")}>
                          Payout
                        </Button>
                      ) : null}
                      {!row.isDefaultSweep && !row.isDefaultPayout ? (
                        <Button variant="danger" disabled={busy} onClick={() => void act(row.id, "disable", "Disable master")}>
                          Disable
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ),
            },
          ]}
          rows={masters}
          getKey={(row) => row.id}
          empty={
            <EmptyState
              compact
              title="No master accounts yet"
              description="Create a settlement master below, or import one that already exists in Safe Haven."
            />
          }
        />
      </section>

      {canManage ? (
        <section className="ops-panel">
          <div className="ops-panel-heading">
            <div>
              <span>Provision</span>
              <h2>Create master account</h2>
            </div>
          </div>
          <p className="ops-panel-copy">
            Safe Haven appends the suffix to the account name, for example{" "}
            <code>APEXLOGIC INNOVATIONS LTD / SETTLEMENT</code>.
          </p>

          <div className="ngn-create-grid">
            <label className="sp-field">
              <span>Account type</span>
              <select value={accountType} onChange={(event) => setAccountType(event.target.value)} disabled={!ready || busy}>
                <option value="Current">Current</option>
                <option value="Savings">Savings</option>
              </select>
            </label>

            <div className="ngn-suffix-field">
              <TextField
                label="Name suffix"
                value={suffix}
                onChange={(event) => setSuffix(event.target.value)}
                placeholder="SETTLEMENT"
                disabled={!ready || busy}
              />
              <div className="ngn-suffix-presets" role="group" aria-label="Suffix presets">
                {SUFFIX_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={suffix === preset ? "is-active" : undefined}
                    disabled={!ready || busy}
                    onClick={() => setSuffix(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <fieldset className="ops-check-list ngn-role-checks">
            <legend>Assign defaults after create</legend>
            <label className="ops-check-row">
              <input
                type="checkbox"
                checked={defaultSweep}
                onChange={(event) => setDefaultSweep(event.target.checked)}
                disabled={!ready || busy}
              />
              <span>
                <strong>Default sweep</strong>
                <small>Customer virtual accounts auto-sweep here</small>
              </span>
            </label>
            <label className="ops-check-row">
              <input
                type="checkbox"
                checked={defaultPayout}
                onChange={(event) => setDefaultPayout(event.target.checked)}
                disabled={!ready || busy}
              />
              <span>
                <strong>Default payout</strong>
                <small>Sell / NGN payouts debit this account</small>
              </span>
            </label>
          </fieldset>

          <div className="ops-inline-actions">
            <Button disabled={busy || !ready || !suffix.trim()} loading={busy} onClick={() => void createMaster()}>
              Create via Safe Haven
            </Button>
          </div>
        </section>
      ) : null}

      {canManage ? (
        <section className="ops-panel">
          <div className="ops-panel-heading">
            <div>
              <span>Reuse</span>
              <h2>Import existing Safe Haven account</h2>
            </div>
            <Button
              variant="secondary"
              disabled={busy || !ready || loadingProviderAccounts}
              loading={loadingProviderAccounts}
              onClick={() => void loadProviderAccounts()}
            >
              {providerAccounts ? "Refresh list" : "Load accounts"}
            </Button>
          </div>
          <p className="ops-panel-copy">
            Use this when settlement accounts already exist in Safe Haven IBS. The default roles selected above apply to the
            import.
          </p>

          {providerAccounts ? (
            <DataTable
              columns={[
                {
                  key: "account",
                  header: "Account",
                  render: (row: ProviderAccount) => (
                    <TablePerson
                      initials={accountInitials(row.accountName, row.accountNumber)}
                      title={row.accountNumber || "—"}
                      subtitle={row.accountName || "Safe Haven account"}
                    />
                  ),
                },
                { key: "type", header: "Type", render: (row) => row.accountType || "—" },
                {
                  key: "balance",
                  header: "Balance",
                  align: "right",
                  render: (row) => formatAmount(row.balance, "NGN"),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (row.registered ? "Already registered" : row.status || "—"),
                },
                {
                  key: "action",
                  header: "Action",
                  render: (row) =>
                    row.registered ? (
                      "—"
                    ) : (
                      <Button
                        variant="secondary"
                        disabled={busy || !ready}
                        onClick={() => void importMaster(row.providerAccountId)}
                      >
                        Import
                      </Button>
                    ),
                },
              ]}
              rows={providerAccounts}
              getKey={(row) => row.providerAccountId}
              empty={<EmptyState compact title="No accounts returned" description="Safe Haven did not return any accounts for this client." />}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
