// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrencyCodeMark, CurrencyPairClip } from "./currency-pair-clip";

afterEach(cleanup);

vi.mock("./currency-logos", () => ({
  isFiatAsset: (code: string) => ["EUR", "USD", "NGN", "AED"].includes(code),
  currencyLogo: (code: string) => <span data-testid={`logo-${code}`}>{code}</span>,
}));

describe("CurrencyPairClip", () => {
  it("renders overlapping source and destination marks", () => {
    render(<CurrencyPairClip from="EUR" to="USDT" />);
    expect(screen.getByTestId("logo-EUR")).toBeInTheDocument();
    expect(screen.getByTestId("logo-USDT")).toBeInTheDocument();
  });
});

describe("CurrencyCodeMark", () => {
  it("leads the currency code with its logo", () => {
    render(<CurrencyCodeMark code="EUR" />);
    expect(screen.getByTestId("logo-EUR")).toBeInTheDocument();
    expect(screen.getAllByText("EUR").length).toBeGreaterThan(0);
  });

  it("renders an em dash for empty codes", () => {
    const { container } = render(<>{CurrencyCodeMark({ code: "" })}</>);
    expect(container.textContent).toBe("—");
  });
});
