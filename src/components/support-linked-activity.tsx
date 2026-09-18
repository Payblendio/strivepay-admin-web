"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowDownLeft, IconArrowUpRight } from "@tabler/icons-react";
import { CurrencyPairClip } from "./currency-pair-clip";

type Activity = { kind: "RAMP" | "CONVERSION" | "ORDER"; id: string };
type Facts = {
  direction: string;
  status: string;
  sourceAsset: string | null;
  sourceAmount: string | null;
  destinationAsset: string | null;
  destinationAmount: string | null;
  createdAt: string;
};

function asIsoTime(value: unknown) {
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return value;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  return null;
}

function asAmount(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && /^-?\d{1,38}(?:\.\d{1,18})?$/.test(value)) return value;
  return undefined;
}

function parseFacts(value: unknown): Facts | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const createdAt = asIsoTime(raw.createdAt);
  const sourceAmount = asAmount(raw.sourceAmount);
  const destinationAmount = asAmount(raw.destinationAmount);
  if (typeof raw.direction !== "string" || typeof raw.status !== "string" || !createdAt) return null;
  if (sourceAmount === undefined || destinationAmount === undefined) return null;
  if (![raw.sourceAsset, raw.destinationAsset].every((item) => item === null || typeof item === "string")) return null;
  return {
    direction: raw.direction,
    status: raw.status,
    sourceAsset: raw.sourceAsset as string | null,
    sourceAmount,
    destinationAsset: raw.destinationAsset as string | null,
    destinationAmount,
    createdAt,
  };
}

function isBuy(direction: string) {
  return ["FIAT_TO_CRYPTO", "BUY", "ONRAMP", "NGN_TO_CRYPTO"].includes(direction.toUpperCase());
}

function amount(value: string | null, asset: string | null) {
  if (value === null) return "Not recorded";
  const [whole, fraction] = value.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}${asset ? ` ${asset}` : ""}`;
}

function activityHref(ticketId: string, activity: Activity) {
  if (activity.kind === "CONVERSION") return `/support/${ticketId}/activity`;
  return `/transactions/${activity.id}`;
}

type Props = {
  ticketId: string;
  revision: number;
  request: (path: string, init?: RequestInit) => Promise<unknown>;
};

export function SupportLinkedActivity({ ticketId, revision, request }: Props) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ticketRef = useRef(ticketId);

  useEffect(() => {
    const ticketChanged = ticketRef.current !== ticketId;
    ticketRef.current = ticketId;
    const controller = new AbortController();

    if (ticketChanged) {
      setActivity(null);
      setFacts(null);
      setReady(false);
      setError(false);
    }

    setBusy(true);
    setError(false);

    void request(`tickets/${ticketId}/activity`, { signal: controller.signal })
      .then((value) => {
        const data = value as { activity?: Activity | null; facts?: unknown };
        if (!data || !("activity" in data)) throw new Error("Invalid activity response");
        const item = data.activity;
        if (
          item !== null
          && (
            !item
            || !["RAMP", "CONVERSION", "ORDER"].includes(item.kind)
            || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)
          )
        ) {
          throw new Error("Invalid activity");
        }
        const nextFacts = data.facts == null ? null : parseFacts(data.facts);
        if (data.facts != null && !nextFacts) throw new Error("Invalid transaction facts");
        if (!controller.signal.aborted) {
          setActivity(item ?? null);
          setFacts(nextFacts);
          setReady(true);
          setBusy(false);
          setError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setActivity(null);
          setFacts(null);
          setReady(true);
          setBusy(false);
          setError(true);
        }
      });

    return () => controller.abort();
  }, [ticketId, revision, request, attempt]);

  if (!ready && !activity && !error) {
    return <p role="status">Loading linked transaction</p>;
  }

  if (error) {
    return (
      <p role="alert">
        Linked transaction could not be loaded.{" "}
        <button type="button" disabled={busy} onClick={() => setAttempt((value) => value + 1)}>
          {busy ? "Refreshing transaction…" : "Retry transaction"}
        </button>
      </p>
    );
  }

  if (!activity) return null;

  const href = activityHref(ticketId, activity);
  const buy = facts ? isBuy(facts.direction) : false;

  return (
    <aside className="support-linked-activity" aria-label="Linked transaction" aria-busy={busy || undefined}>
      {facts ? (
        <>
          <div className="support-linked-activity-lead">
            <span className="support-linked-direction">
              <CurrencyPairClip from={facts.sourceAsset} to={facts.destinationAsset} size="sm" />
              {buy ? <IconArrowUpRight size={14} /> : <IconArrowDownLeft size={14} />}
              {facts.direction.replaceAll("_", " ")}
            </span>
            <span className="support-linked-status">{facts.status}</span>
          </div>
          <div className="support-linked-amounts">
            <span>
              <small>Sent</small>
              {amount(facts.sourceAmount, facts.sourceAsset)}
            </span>
            <span>
              <small>{facts.destinationAmount != null ? "Received" : "Destination"}</small>
              {amount(facts.destinationAmount, facts.destinationAsset)}
            </span>
          </div>
        </>
      ) : (
        <p className="support-muted">Linked {activity.kind.toLowerCase()} reference is available.</p>
      )}
      <div className="support-linked-actions">
        <a href={href} target="_blank" rel="noopener noreferrer">
          Open transaction ↗
        </a>
        <button type="button" disabled={busy} onClick={() => setAttempt((value) => value + 1)}>
          {busy ? "Refreshing transaction…" : "Refresh transaction"}
        </button>
      </div>
    </aside>
  );
}
