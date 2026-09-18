"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { IconArrowLeft } from "@tabler/icons-react";

export type OpsDetailTab = {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
};

export function OpsDetailShell({
  backHref,
  backLabel = "Back",
  headerTitle,
  headerActions,
  tabs,
  navLabel = "Details",
  sidebarSummary,
  defaultTab,
}: {
  backHref: string;
  backLabel?: string;
  headerTitle: ReactNode;
  headerActions?: ReactNode;
  tabs: OpsDetailTab[];
  navLabel?: string;
  sidebarSummary?: ReactNode;
  defaultTab?: string;
}) {
  const initial = defaultTab && tabs.some((tab) => tab.id === defaultTab)
    ? defaultTab
    : tabs[0]?.id ?? "";
  const [activeTab, setActiveTab] = useState(initial);
  const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const showNav = tabs.length > 1;

  return (
    <div className="ops-detail-shell">
      <header className="ops-detail-header">
        <div className="ops-detail-header-inner">
          <div className="ops-detail-header-lead">
            <Link className="ops-detail-back" href={backHref} aria-label={backLabel}>
              <IconArrowLeft size={20} stroke={2} />
            </Link>
            <div className="ops-detail-header-divider" aria-hidden="true" />
            <div className="ops-detail-header-title">{headerTitle}</div>
          </div>
          {headerActions ? <div className="ops-detail-header-actions">{headerActions}</div> : null}
        </div>
      </header>

      {showNav ? (
        <div className="ops-detail-tabs-mobile" role="tablist" aria-label={navLabel}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === current?.id}
              className={tab.id === current?.id ? "active" : undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={`ops-detail-body${showNav ? " has-nav" : ""}`}>
        {showNav ? (
          <nav className="ops-detail-sidebar" aria-label={navLabel}>
            <p className="ops-detail-sidebar-label">{navLabel}</p>
            <div className="ops-detail-sidebar-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={tab.id === current?.id}
                  className={tab.id === current?.id ? "active" : undefined}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon ? <span className="ops-detail-tab-icon">{tab.icon}</span> : null}
                  {tab.label}
                </button>
              ))}
            </div>
            {sidebarSummary ? <div className="ops-detail-sidebar-summary">{sidebarSummary}</div> : null}
          </nav>
        ) : null}

        <main className="ops-detail-main">
          <div className="ops-detail-main-inner" key={current?.id}>
            {current?.content}
          </div>
        </main>
      </div>
    </div>
  );
}

export function OpsDetailTitle({
  icon,
  title,
  status,
  subtitle,
}: {
  icon?: ReactNode;
  title: ReactNode;
  status?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="ops-detail-title">
      {icon ? <div className="ops-detail-title-icon">{icon}</div> : null}
      <div className="ops-detail-title-copy">
        <div className="ops-detail-title-row">
          <p className="ops-detail-title-text">{title}</p>
          {status}
        </div>
        {subtitle ? <p className="ops-detail-title-sub">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export function OpsDetailSection({
  title,
  kicker = "Detail",
  children,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <section className="ops-detail-card">
      <header className="ops-detail-card-head">
        <span className="ops-detail-kicker">{kicker}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function OpsDetailFacts({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="ops-detail-facts">
      {items.map((item) => (
        <div key={item.label} className="ops-detail-fact">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OpsDetailSummary({
  title = "Quick summary",
  items,
}: {
  title?: string;
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="ops-detail-summary-card">
      <p>{title}</p>
      <dl>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
