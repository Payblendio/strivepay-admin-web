import type { ReactNode } from "react";
import { Button } from "./primitives";

export function EmptyState({ title, description, action, compact = false }: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  compact?: boolean;
}) {
  return (
    <div className={`sp-empty${compact ? " compact" : ""}`}>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <Button onClick={action.onClick}>{action.label}</Button> : null}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="ops-loading" role="status" aria-live="polite">
      <span className="ops-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function DetailList({ items }: { items: { label: string; value: ReactNode; emphasized?: boolean }[] }) {
  return (
    <dl className="sp-details">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd className={item.emphasized ? "emphasized" : ""}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
