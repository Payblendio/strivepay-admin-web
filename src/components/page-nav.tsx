import Link from "next/link";

export function PageNav({
  page,
  size,
  total,
  hrefFor,
}: {
  page: number;
  size: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  if (total <= 0) return null;
  const pageSize = Math.max(size, 1);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 0), pages - 1);
  const from = current * pageSize + 1;
  const to = Math.min(total, (current + 1) * pageSize);
  const previous = Math.max(0, current - 1);
  const next = Math.min(pages - 1, current + 1);

  const pageItems: Array<number | "gap"> = [];
  for (let index = 0; index < pages; index += 1) {
    const show = index === 0 || index === pages - 1 || Math.abs(index - current) <= 1;
    if (!show) {
      if (pageItems[pageItems.length - 1] !== "gap") pageItems.push("gap");
      continue;
    }
    pageItems.push(index);
  }

  return (
    <nav className="ops-pagination" aria-label="Pagination">
      <span className="ops-pagination-meta">
        {from}–{to} of {total}
      </span>
      {pages > 1 ? (
        <div className="ops-pagination-controls">
          {current > 0 ? <Link className="ops-pagination-btn" href={hrefFor(previous)}>‹</Link> : <span className="ops-pagination-btn is-disabled">‹</span>}
          {pageItems.map((item, index) => (
            item === "gap"
              ? <span key={`gap-${index}`} className="ops-pagination-gap">…</span>
              : item === current
                ? <span key={item} className="ops-pagination-btn is-active" aria-current="page">{item + 1}</span>
                : <Link key={item} className="ops-pagination-btn" href={hrefFor(item)}>{item + 1}</Link>
          ))}
          {current + 1 < pages ? <Link className="ops-pagination-btn" href={hrefFor(next)}>›</Link> : <span className="ops-pagination-btn is-disabled">›</span>}
        </div>
      ) : null}
    </nav>
  );
}
