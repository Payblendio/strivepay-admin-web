"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-session";
import { asRecord, text } from "@/lib/values";

type PartyOption = {
  id: string;
  name: string;
  email: string;
  partyType: string;
};

function labelFor(row: Record<string, unknown>): PartyOption {
  const id = text(row, "id");
  const name = text(row, "name");
  const email = text(row, "email");
  const partyType = text(row, "party_type", "partyType");
  const ownerName = text(row, "owner_name", "ownerName");
  const displayName = name !== "—" ? name : partyType.toUpperCase() === "ORGANIZATION" ? "Organization" : email;
  const displayEmail =
    email !== "—"
      ? email
      : partyType.toUpperCase() === "ORGANIZATION" && ownerName !== "—"
        ? `Owner · ${ownerName}`
        : "No email";
  return { id, name: displayName === "—" ? id : displayName, email: displayEmail, partyType };
}

export function PartySearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (partyId: string, selected: PartyOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PartyOption[]>([]);
  const [selected, setSelected] = useState<PartyOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (selected || !query.trim()) {
      setResults([]);
      setSearchError("");
      return;
    }
    const term = query.trim();
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setSearchError("");
        try {
          const params = new URLSearchParams({ q: term, page: "0", size: "8" });
          const response = await adminFetch(`/api/admin/customers?${params}`);
          const payload = await response.json().catch(() => null) as {
            items?: unknown[];
            title?: string;
            detail?: string;
          } | null;
          if (!response.ok) {
            setResults([]);
            setSearchError(payload?.detail ?? payload?.title ?? "Customer search failed.");
            return;
          }
          setResults((payload?.items ?? []).map((item) => labelFor(asRecord(item))).filter((item) => item.id !== "—"));
        } catch {
          setResults([]);
          setSearchError("Customer search failed.");
        } finally {
          setLoading(false);
        }
      })();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, selected]);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      setQuery("");
      setResults([]);
    }
  }, [value]);

  if (selected && value === selected.id) {
    return (
      <div className="sp-field party-search-field">
        <span>Party</span>
        <div className="party-search-selected">
          <div>
            <strong>{selected.name}</strong>
            <small>{selected.email}</small>
          </div>
          <button
            type="button"
            className="sp-button quiet small"
            onClick={() => {
              setSelected(null);
              setQuery("");
              onChange("", null);
            }}
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-field party-search-field">
      <span>Party</span>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or email"
        autoComplete="off"
        required={!value}
      />
      {loading ? <small className="ops-inline-note">Searching…</small> : null}
      {searchError ? <small className="ops-inline-note party-search-error">{searchError}</small> : null}
      {!loading && query.trim() && !results.length && !searchError ? (
        <small className="ops-inline-note">No matches.</small>
      ) : null}
      {results.length ? (
        <ul className="party-search-results">
          {results.map((party) => (
            <li key={party.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(party);
                  setQuery("");
                  setResults([]);
                  onChange(party.id, party);
                }}
              >
                <strong>{party.name}</strong>
                <small>{party.email} · {party.partyType}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
