import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBanner } from "./StatusBanner";

describe("StatusBanner", () => {
  it("shows checkmate winner", () => {
    const { getByText } = render(<StatusBanner status="checkmate" aiError={null} winner="w" />);
    expect(getByText(/checkmate/i)).toBeTruthy();
    expect(getByText(/white/i)).toBeTruthy();
  });
  it("shows AI error when present", () => {
    const { getByText } = render(<StatusBanner status="playing" aiError="LM Studio offline" winner={null} />);
    expect(getByText(/LM Studio offline/i)).toBeTruthy();
  });
});
