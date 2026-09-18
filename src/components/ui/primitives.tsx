"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export function Badge({ children, tone = "neutral", dot = false }: { children: ReactNode; tone?: Tone; dot?: boolean }) {
  return <span className={`sp-badge ${tone}`}>{dot && <i aria-hidden="true" />}{children}</span>;
}

export function Chip({ children, selected = false, onRemove }: { children: ReactNode; selected?: boolean; onRemove?: () => void }) {
  return <span className={`sp-chip${selected ? " selected" : ""}`}><span>{children}</span>{onRemove && <button type="button" onClick={onRemove} aria-label="Remove">×</button>}</span>;
}

export function Button({ children, variant = "primary", size = "medium", loading = false, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "danger"; size?: "small" | "medium" | "large"; loading?: boolean }) {
  return <button {...props} className={`sp-button ${variant} ${size} ${props.className ?? ""}`} disabled={loading || props.disabled}>{loading && <span className="button-spinner" aria-hidden="true" />}{children}</button>;
}

export function TextField({ label, hint, error, prefix, suffix, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; prefix?: ReactNode; suffix?: ReactNode }) {
  const id = useId();
  return <div className={`sp-field${error ? " invalid" : ""}`}><label htmlFor={id}>{label}</label><div className="sp-input-wrap">{prefix && <span className="field-affix">{prefix}</span>}<input id={id} {...props} />{suffix && <span className="field-affix">{suffix}</span>}</div>{(error || hint) && <small>{error || hint}</small>}</div>;
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string }) {
  return <label className="sp-toggle-row"><span><strong>{label}</strong>{description && <small>{description}</small>}</span><button type="button" role="switch" aria-checked={checked} className={`sp-toggle${checked ? " checked" : ""}`} onClick={() => onChange(!checked)}><i /></button></label>;
}

export function Progress({ value, label, detail, tone = "info" }: { value: number; label?: string; detail?: string; tone?: Tone }) {
  const safe = Math.max(0, Math.min(100, value));
  return <div className="sp-progress">{(label || detail) && <div><strong>{label}</strong><span>{detail ?? `${safe}%`}</span></div>}<span className="progress-track"><i className={tone} style={{ width: `${safe}%` }} /></span></div>;
}

export function Skeleton({ width = "100%", height = 16, radius = 8 }: { width?: string | number; height?: number; radius?: number }) {
  return <span className="sp-skeleton" style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return <span className="sp-tooltip" tabIndex={0}>{children}<span role="tooltip">{content}</span></span>;
}

export function Notice({ tone = "info", title, children, action }: { tone?: Tone; title: string; children: ReactNode; action?: ReactNode }) {
  const marks: Record<Tone, string> = { neutral: "i", info: "i", success: "✓", warning: "!", danger: "×" };
  return <div className={`sp-notice ${tone}`}><i>{marks[tone]}</i><div><strong>{title}</strong><p>{children}</p></div>{action && <span className="notice-action">{action}</span>}</div>;
}

export function SegmentedControl({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <div className="sp-segments" role="tablist">{options.map(option => <button key={option.value} type="button" role="tab" aria-selected={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}
