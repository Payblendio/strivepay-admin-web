"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { DetailList, EmptyState, LoadingState } from "@/components/ui/status-state";
import { useToast } from "@/components/ui/toast";
import { adminFetch } from "@/lib/admin-session";
import { confirmAction, notifySuccess, promptReason } from "@/lib/swal";
import { webhookProvider, type WebhookEndpoint } from "@/lib/webhooks";
import { toneForStatus } from "@/lib/values";

const DEFAULT_EVENTS = ["KYC", "KYB", "fiatToCrypto", "cryptoToFiat"];
const FIAT_SUBTYPES = ["IN_PROGRESS", "CRYPTO_TRANSFER_ISSUED", "SUCCESS", "ON_HOLD", "FAILED", "REFUNDED"];
const CRYPTO_SUBTYPES = ["IN_PROGRESS", "FIAT_TRANSFER_ISSUED", "SUCCESS", "ON_HOLD", "FAILED", "LIMIT_BREACHED", "REFUNDED"];

function problemTitle(data: { title?: string; detail?: string } | null, fallback: string) {
  return data?.title ?? data?.detail ?? fallback;
}

export function WebhookSetup({
  provider,
  callbackUrl,
  canSync,
  canManage,
}: {
  provider: string;
  callbackUrl: string;
  canSync: boolean;
  canManage: boolean;
}) {
  const { show } = useToast();
  const config = webhookProvider(provider);
  const bakkt = provider === "BAKKT";
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(bakkt);
  const [rows, setRows] = useState<WebhookEndpoint[]>([]);
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState<WebhookEndpoint | null>(null);
  const [testType, setTestType] = useState("fiatToCrypto");
  const [events, setEvents] = useState<string[]>(DEFAULT_EVENTS);
  const [url, setUrl] = useState(callbackUrl);
  const [description, setDescription] = useState("StrivePay settlement");
  const [error, setError] = useState("");

  async function fetchEndpoints() {
    const started = Date.now();
    const response = await adminFetch("/api/admin/provider/webhook-endpoints");
    const wait = 400 - (Date.now() - started);
    if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { title?: string; detail?: string } | null;
      return { rows: [] as WebhookEndpoint[], error: problemTitle(data, "Could not load Bakkt endpoints") };
    }
    const data = await response.json() as WebhookEndpoint[];
    return { rows: Array.isArray(data) ? data : [], error: "" };
  }

  useEffect(() => {
    if (!bakkt) return;
    let cancelled = false;
    void fetchEndpoints().then((result) => {
      if (cancelled) return;
      setRows(result.rows);
      setError(result.error);
      if (result.error) show({ tone: "danger", title: result.error });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [bakkt, show]);

  async function load() {
    if (!bakkt) return;
    setLoading(true);
    const result = await fetchEndpoints();
    setRows(result.rows);
    setError(result.error);
    if (result.error) show({ tone: "danger", title: result.error });
    setLoading(false);
    setBusy(false);
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      show({ tone: "success", title: "Callback URL copied" });
    } catch {
      show({ tone: "danger", title: "Could not copy the URL" });
    }
  }

  async function mutate(path: string, method: string, body: unknown, fallback: string) {
    setBusy(true);
    const response = await adminFetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 204 && response.status !== 202) {
      setBusy(false);
      const data = await response.json().catch(() => null) as { title?: string; detail?: string } | null;
      show({ tone: "danger", title: problemTitle(data, fallback) });
      return false;
    }
    return true;
  }

  async function syncCoverage() {
    setBusy(true);
    const response = await adminFetch("/api/admin/coverage/settlement/sync", { method: "POST" });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { title?: string; detail?: string } | null;
      show({ tone: "danger", title: problemTitle(data, "Coverage sync failed") });
      return;
    }
    await notifySuccess("Coverage synchronized", "Bakkt settlement coverage was refreshed from the provider.");
  }

  async function addEndpoint() {
    if (!events.length) {
      show({ tone: "danger", title: "Select at least one event type" });
      return;
    }
    setCreating(false);
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    const reason = await promptReason({
      title: "Add Bakkt endpoint",
      text: "Bakkt returns the signing secret once. StrivePay encrypts it and never shows it here.",
      confirmLabel: "Create",
    });
    if (!reason) {
      setCreating(true);
      return;
    }
    if (!await mutate("/api/admin/provider/webhook-endpoints", "POST", { url, description, subscribedEvents: events, reason }, "Could not create the endpoint")) {
      setCreating(true);
      return;
    }
    await load();
    await notifySuccess("Endpoint created", "The signing secret was stored encrypted. It is never displayed in this desk.");
  }

  async function toggle(row: WebhookEndpoint) {
    const next = row.status === "active" ? "disabled" : "active";
    const reason = await promptReason({
      title: next === "active" ? "Activate endpoint" : "Disable endpoint",
      text: next === "active" ? "Bakkt will start delivering events to this URL." : "Bakkt will stop delivering events to this URL.",
      confirmLabel: next === "active" ? "Activate" : "Disable",
    });
    if (!reason) return;
    if (!await mutate(`/api/admin/provider/webhook-endpoints/${row.providerEndpointId}`, "PATCH", { status: next, reason }, "Could not update the endpoint")) return;
    await load();
    await notifySuccess(next === "active" ? "Endpoint active" : "Endpoint disabled");
  }

  async function rotate(row: WebhookEndpoint) {
    const reason = await promptReason({
      title: "Rotate signing secret",
      text: "Bakkt issues a new secret. Inbound events must use the new secret after this call.",
      confirmLabel: "Rotate",
    });
    if (!reason) return;
    if (!await mutate(`/api/admin/provider/webhook-endpoints/${row.providerEndpointId}/secret`, "PATCH", { reason }, "Could not rotate the secret")) return;
    await load();
    await notifySuccess("Secret rotated", "The new secret was encrypted at rest and is not shown here.");
  }

  async function remove(row: WebhookEndpoint) {
    const ok = await confirmAction({ title: "Delete endpoint", text: "Bakkt will stop calling this URL. Inbox logs are kept.", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    const reason = await promptReason({ title: "Delete endpoint", text: "Record why this Bakkt destination is being removed.", confirmLabel: "Delete" });
    if (!reason) return;
    if (!await mutate(`/api/admin/provider/webhook-endpoints/${row.providerEndpointId}`, "DELETE", { reason }, "Could not delete the endpoint")) return;
    await load();
    await notifySuccess("Endpoint deleted");
  }

  async function sendTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!testing) return;
    const form = new FormData(event.currentTarget);
    const userUuid = String(form.get("userUuid") ?? "").trim();
    const corporateUuid = String(form.get("corporateUuid") ?? "").trim();
    if (!await mutate(`/api/admin/provider/webhook-endpoints/${testing.providerEndpointId}/test`, "POST", {
      type: testType,
      subType: String(form.get("subType") ?? ""),
      userUuid: userUuid || null,
      corporateUuid: corporateUuid || null,
    }, "Test webhook failed")) return;
    setBusy(false);
    setTesting(null);
    await notifySuccess("Test accepted", "Bakkt accepted the sandbox webhook simulation.");
  }

  const visible = status ? rows.filter((row) => row.status === status) : rows;
  const subtypes = testType === "cryptoToFiat" ? CRYPTO_SUBTYPES : FIAT_SUBTYPES;

  return (
    <>
      <section className="ops-panel">
        <div className="ops-panel-head">
          <div>
            <h2>{config.label} webhook setup</h2>
            <p>
              {bakkt
                ? "Register this callback with Bakkt, then activate, rotate, or retire endpoints from this desk. The signing secret is never displayed."
                : "Copy this callback into the Quidax dashboard. Quidax does not expose a merchant endpoint API from this desk."}
            </p>
          </div>
          {bakkt && canManage ? (
            <Button type="button" onClick={() => { setUrl(callbackUrl); setCreating(true); }}>Add endpoint</Button>
          ) : null}
        </div>
        <DetailList
          items={[
            { label: "Suggested callback URL", value: callbackUrl, emphasized: true },
            { label: "Authentication", value: config.auth },
            { label: "Extra headers", value: config.extraHeaders.length ? config.extraHeaders.join(", ") : "—" },
            { label: "Env fallback", value: config.secretEnv },
          ]}
        />
        <p>{config.notes}</p>
        <div className="reason-actions">
          <Button type="button" variant="secondary" onClick={() => void copyUrl()}>Copy callback URL</Button>
          {bakkt && canSync ? (
            <Button type="button" loading={busy} onClick={() => void syncCoverage()}>Sync settlement coverage</Button>
          ) : null}
        </div>
      </section>

      {bakkt ? (
        <section className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h2>Bakkt endpoints</h2>
              <p>Live destinations Bakkt will POST signed events to. HTTPS is required outside the local simulator.</p>
            </div>
            <div className="ops-toolbar">
              <label className="sp-field">
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">All</option>
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                  <option value="auto_disabled">auto_disabled</option>
                </select>
              </label>
              <Button type="button" variant="secondary" loading={loading} onClick={() => void load()}>Refresh</Button>
            </div>
          </div>
          {error ? <p>{error}</p> : null}
          <div className="ops-table-frame" aria-busy={loading || busy}>
            {loading && rows.length === 0 ? (
              <LoadingState label="Loading Bakkt endpoints…" />
            ) : (
              <DataTable
                columns={[
                  { key: "description", header: "Description", render: (row) => row.description || "—" },
                  { key: "url", header: "URL", render: (row) => <span className="ops-mono">{row.url}</span> },
                  { key: "status", header: "Status", render: (row) => <Badge tone={toneForStatus(row.status)} dot>{row.status}</Badge> },
                  { key: "events", header: "Events", render: (row) => (row.subscribedEvents ?? []).join(", ") || "—" },
                  { key: "secret", header: "Secret", render: (row) => <Badge tone={row.signingSecretStored ? "success" : "warning"}>{row.signingSecretStored ? "stored" : "missing"}</Badge> },
                  { key: "updated", header: "Updated", render: (row) => row.updatedAt ? row.updatedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC") : "—" },
                  {
                    key: "actions",
                    header: "",
                    render: (row) => canManage ? (
                      <span className="reason-actions">
                        <Button size="small" variant="secondary" disabled={busy || loading} onClick={() => void toggle(row)}>{row.status === "active" ? "Disable" : "Activate"}</Button>
                        <Button size="small" variant="secondary" disabled={busy || loading} onClick={() => void rotate(row)}>Rotate</Button>
                        {row.providerMode === "SANDBOX" ? <Button size="small" variant="quiet" disabled={busy || loading} onClick={() => { setTestType("fiatToCrypto"); setTesting(row); }}>Test</Button> : null}
                        <Button size="small" variant="quiet" disabled={busy || loading} onClick={() => void remove(row)}>Delete</Button>
                      </span>
                    ) : null,
                  },
                ]}
                rows={visible}
                getKey={(row) => row.providerEndpointId}
                empty={<EmptyState compact title="No Bakkt endpoints" description="Add an HTTPS destination so Bakkt can deliver KYC, KYB, and settlement events." />}
              />
            )}
            {busy || (loading && rows.length > 0) ? (
              <div className="ops-table-overlay">
                <LoadingState label={busy && !loading ? "Updating Bakkt endpoints…" : "Loading Bakkt endpoints…"} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {creating ? (
      <Modal className="access-selector-dialog" open={creating} onClose={() => setCreating(false)} title="Add Bakkt endpoint" description="Bakkt will POST signed events to this URL. HTTPS is required in sandbox and live.">
        <form
          className="reason-form"
          onSubmit={(event) => {
            event.preventDefault();
            void addEndpoint();
          }}
        >
          <label className="sp-field">
            <span>Callback URL</span>
            <input value={url} onChange={(event) => setUrl(event.target.value)} required />
          </label>
          <label className="sp-field">
            <span>Description</span>
            <input value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={255} />
          </label>
          <fieldset className="ops-event-grid">
            <legend>Subscribed events</legend>
            {config.events.map((eventName) => (
              <label key={eventName}>
                <input
                  type="checkbox"
                  checked={events.includes(eventName)}
                  onChange={(change) => setEvents((current) => change.target.checked ? [...current, eventName] : current.filter((value) => value !== eventName))}
                />
                {eventName}
              </label>
            ))}
          </fieldset>
          <div className="reason-actions">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Continue</Button>
          </div>
        </form>
      </Modal>
      ) : null}

      {testing ? (
      <Modal className="access-selector-dialog" open={Boolean(testing)} onClose={() => setTesting(null)} title="Test webhook" description="Sandbox only. Provide exactly one of user UUID or corporate UUID.">
        <form className="reason-form" onSubmit={(event) => void sendTest(event)}>
          <label className="sp-field">
            <span>Type</span>
            <select name="type" value={testType} onChange={(event) => setTestType(event.target.value)}>
              <option value="fiatToCrypto">fiatToCrypto</option>
              <option value="cryptoToFiat">cryptoToFiat</option>
            </select>
          </label>
          <label className="sp-field">
            <span>Subtype</span>
            <select name="subType" defaultValue="IN_PROGRESS" key={testType}>
              {subtypes.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="sp-field">
            <span>User UUID</span>
            <input name="userUuid" placeholder="optional" />
          </label>
          <label className="sp-field">
            <span>Corporate UUID</span>
            <input name="corporateUuid" placeholder="optional" />
          </label>
          <div className="reason-actions">
            <Button type="button" variant="secondary" onClick={() => setTesting(null)}>Cancel</Button>
            <Button type="submit" loading={busy}>Send test</Button>
          </div>
        </form>
      </Modal>
      ) : null}
    </>
  );
}
