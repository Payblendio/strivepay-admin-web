import type { ReactNode } from "react";

export type Column<Row> = { key: string; header: string; align?: "left" | "right" | "center"; render: (row: Row) => ReactNode };

export function DataTable<Row>({ columns, rows, getKey, empty }: { columns: Column<Row>[]; rows: Row[]; getKey: (row: Row) => string; empty?: ReactNode }) {
  if (!rows.length) return <div className="table-empty">{empty ?? "No records found."}</div>;
  return <div className="table-scroll"><table className="sp-table"><thead><tr>{columns.map(column => <th key={column.key} className={column.align ?? "left"}>{column.header}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={getKey(row)}>{columns.map(column => <td key={column.key} className={column.align ?? "left"} data-label={column.header}>{column.render(row)}</td>)}</tr>)}</tbody></table></div>;
}

export function TablePerson({ initials, title, subtitle }: { initials: string; title: string; subtitle: string }) {
  return <span className="table-person"><i>{initials}</i><span><strong>{title}</strong><small>{subtitle}</small></span></span>;
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  const visible = Array.from({ length: pages }, (_, index) => index + 1).filter(item => item === 1 || item === pages || Math.abs(item - page) <= 1);
  return <nav className="sp-pagination" aria-label="Pagination"><button type="button" disabled={page === 1} onClick={() => onChange(page - 1)}>‹</button>{visible.map((item, index) => <span key={item}>{index > 0 && item - visible[index - 1] > 1 && <i>…</i>}<button type="button" className={item === page ? "active" : ""} onClick={() => onChange(item)}>{item}</button></span>)}<button type="button" disabled={page === pages} onClick={() => onChange(page + 1)}>›</button></nav>;
}
