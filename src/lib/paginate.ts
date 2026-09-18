/** Slice an in-memory list for URL page navigation. */
export function slicePage<T>(rows: T[], page: number, size: number) {
  const total = rows.length;
  const pageSize = Math.max(1, size);
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const current = Math.min(Math.max(0, page), pages - 1);
  const start = current * pageSize;
  return {
    page: current,
    size: pageSize,
    total,
    rows: rows.slice(start, start + pageSize),
  };
}
