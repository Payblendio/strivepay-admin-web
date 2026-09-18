import { describe, expect, it } from "vitest";
import { slicePage } from "./paginate";

describe("slicePage", () => {
  const rows = Array.from({ length: 45 }, (_, index) => index + 1);

  it("returns the first page", () => {
    const page = slicePage(rows, 0, 20);
    expect(page).toEqual({ page: 0, size: 20, total: 45, rows: rows.slice(0, 20) });
  });

  it("returns a middle page", () => {
    const page = slicePage(rows, 1, 20);
    expect(page.page).toBe(1);
    expect(page.rows).toEqual(rows.slice(20, 40));
    expect(page.total).toBe(45);
  });

  it("clamps an out-of-range page", () => {
    const page = slicePage(rows, 99, 20);
    expect(page.page).toBe(2);
    expect(page.rows).toEqual(rows.slice(40, 45));
  });

  it("handles empty lists", () => {
    expect(slicePage([], 0, 20)).toEqual({ page: 0, size: 20, total: 0, rows: [] });
  });
});
