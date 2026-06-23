import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Board } from "./Board";

describe("Board", () => {
  it("renders 64 squares and shows dots on legal targets", () => {
    const { container } = render(
      <Board
        selected="e2"
        legalTargets={["e3", "e4"]}
        occupied={() => false}
        onSquareClick={() => {}}
      />
    );
    expect(container.querySelectorAll("[data-square]").length).toBe(64);
    expect(container.querySelectorAll("[data-dot]").length).toBe(2);
  });

  it("calls onSquareClick with the clicked square", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Board selected={null} legalTargets={[]} occupied={() => false} onSquareClick={onClick} />
    );
    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;
    fireEvent.click(e2);
    expect(onClick).toHaveBeenCalledWith("e2");
  });
});
