"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import {
  IconArrowsExchange,
  IconBell,
  IconCashBanknote,
  IconFileSearch,
  IconHistory,
  IconLoader2,
  IconMessageCircle,
  IconSearch,
  IconUserShield,
  IconUsers,
  IconWallet,
  IconWebhook,
} from "@tabler/icons-react";
import { adminFetch } from "@/lib/admin-session";

export type SearchPage = {
  label: string;
  href: string;
  group: string;
  hint: string;
  icon: ComponentType<{ size?: number }>;
};

type Hit = { id: string; kind: string; title: string; subtitle: string | null; meta: string | null; href: string };
type Section = { key: string; label: string; hits: Hit[] };
type Row = { key: string; href: string; title: string; subtitle?: string | null; meta?: string | null; icon: ComponentType<{ size?: number }> };

const KIND_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  CUSTOMER: IconUsers,
  PAY_IN_ACCOUNT: IconWallet,
  DESTINATION_ACCOUNT: IconCashBanknote,
  TRANSACTION: IconArrowsExchange,
  SUPPORT_TICKET: IconMessageCircle,
  WEBHOOK: IconWebhook,
  NOTIFICATION: IconBell,
  ADMIN: IconUserShield,
  API_REQUEST: IconHistory,
};

function scorePage(page: SearchPage, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const label = page.label.toLowerCase();
  const haystack = `${label} ${page.group} ${page.hint} ${page.href}`.toLowerCase();
  let score = 0;
  if (label === q) score += 100;
  else if (label.startsWith(q)) score += 60;
  else if (label.includes(q)) score += 30;
  if (page.group.toLowerCase().includes(q)) score += 12;
  if (page.hint.toLowerCase().includes(q)) score += 10;
  if (page.href.toLowerCase().includes(q)) score += 8;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => haystack.includes(token))) score += 20 + tokens.length * 4;
  else if (!score && tokens.length && tokens.every((token) => haystack.includes(token))) score += 6;
  return score;
}

export function GlobalSearch({ pages, open, onClose }: { pages: SearchPage[]; open: boolean; onClose: () => void }) {
  return open ? <SearchDialog pages={pages} onClose={onClose} /> : null;
}

type Remote = { query: string; sections: Section[]; failed: boolean };

function SearchDialog({ pages, onClose }: { pages: SearchPage[]; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<Remote>({ query: "", sections: [], failed: false });
  const [selected, setActive] = useState(0);
  const trimmed = query.trim();
  const searchable = trimmed.length >= 2;
  const current = searchable && remote.query === trimmed;
  const sections = useMemo(() => (current ? remote.sections : []), [current, remote.sections]);
  const failed = current && remote.failed;
  const loading = searchable && !current;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await adminFetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}&limit=5`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { sections?: Section[] };
        setRemote({ query: trimmed, sections: data.sections ?? [], failed: false });
      } catch {
        if (!controller.signal.aborted) setRemote({ query: trimmed, sections: [], failed: true });
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed, searchable]);

  const matchedPages = useMemo(
    () =>
      pages
        .map((page) => ({ page, score: scorePage(page, query) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, query.trim() ? 6 : 8)
        .map(({ page }) => page),
    [pages, query],
  );

  const groups = useMemo(() => {
    const out: { key: string; label: string; rows: Row[] }[] = [];
    if (matchedPages.length) {
      out.push({
        key: "pages",
        label: query.trim() ? "Pages" : "Jump to",
        rows: matchedPages.map((page) => ({ key: `page:${page.href}`, href: page.href, title: page.label, subtitle: `${page.group} · ${page.hint}`, icon: page.icon })),
      });
    }
    for (const section of sections) {
      out.push({
        key: section.key,
        label: section.label,
        rows: section.hits.map((hit) => ({
          key: `${section.key}:${hit.id}`,
          href: hit.href,
          title: hit.title,
          subtitle: hit.subtitle,
          meta: hit.meta,
          icon: KIND_ICONS[hit.kind] ?? IconFileSearch,
        })),
      });
    }
    return out;
  }, [matchedPages, sections, query]);

  const rows = useMemo(() => groups.flatMap((group) => group.rows), [groups]);
  const active = selected < rows.length ? selected : 0;

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(row: Row | undefined) {
    if (!row) return;
    onClose();
    router.push(row.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(rows.length ? (active + 1) % rows.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(rows.length ? (active - 1 + rows.length) % rows.length : 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(rows[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  let index = -1;

  return (
    <div className="ops-search-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="ops-search" role="dialog" aria-modal="true" aria-label="Search admin" onKeyDown={onKeyDown}>
        <div className="ops-search-field">
          <IconSearch size={20} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            placeholder="Search pages, customers, transactions, tickets, emails, IDs…"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="ops-search-results"
            aria-activedescendant={rows[active] ? `ops-search-row-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          {loading ? <IconLoader2 className="ops-search-spinner" size={18} /> : null}
          <kbd onClick={onClose}>Esc</kbd>
        </div>

        <div className="ops-search-results" id="ops-search-results" role="listbox" ref={listRef}>
          {groups.map((group) => (
            <div className="ops-search-group" key={group.key} role="group" aria-label={group.label}>
              <span className="ops-search-heading">{group.label}</span>
              {group.rows.map((row) => {
                index += 1;
                const rowIndex = index;
                const Icon = row.icon;
                return (
                  <button
                    type="button"
                    key={row.key}
                    id={`ops-search-row-${rowIndex}`}
                    data-index={rowIndex}
                    role="option"
                    aria-selected={rowIndex === active}
                    className={`ops-search-row${rowIndex === active ? " active" : ""}`}
                    onMouseMove={() => setActive(rowIndex)}
                    onClick={() => go(row)}
                  >
                    <span className="ops-search-icon"><Icon size={17} /></span>
                    <span className="ops-search-text">
                      <strong>{row.title}</strong>
                      {row.subtitle ? <small>{row.subtitle}</small> : null}
                    </span>
                    {row.meta ? <em>{row.meta}</em> : null}
                  </button>
                );
              })}
            </div>
          ))}

          {!rows.length && !loading ? (
            <div className="ops-search-empty">
              <IconFileSearch size={28} />
              <strong>{failed ? "Search is unavailable right now" : trimmed.length < 2 ? "Type at least 2 characters" : `No results for “${trimmed}”`}</strong>
              <small>{failed ? "Try again in a moment." : "Search by name, email, phone, account number, ticket number, reference or ID."}</small>
            </div>
          ) : null}
          {trimmed.length >= 2 && !loading && !failed && rows.length > 0 && !sections.length ? (
            <p className="ops-search-note">No records matched. Showing pages only.</p>
          ) : null}
        </div>

        <footer className="ops-search-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
          <span className="ops-search-foot-end"><kbd>Ctrl</kbd><kbd>K</kbd> or <kbd>/</kbd> anywhere</span>
        </footer>
      </div>
    </div>
  );
}

const noSubscribe = () => () => {};

export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  const mac = useSyncExternalStore(noSubscribe, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
  return (
    <button type="button" className="ops-search-trigger" onClick={onOpen} aria-label="Search admin">
      <IconSearch size={18} />
      <span>Search…</span>
      <kbd>{mac ? "⌘" : "Ctrl"} K</kbd>
    </button>
  );
}
