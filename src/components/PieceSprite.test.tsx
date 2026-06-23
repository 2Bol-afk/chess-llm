import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PieceSprite } from "./PieceSprite";

describe("PieceSprite", () => {
  it("renders an svg for each piece type", () => {
    const types = ["p", "n", "b", "r", "q", "k"] as const;
    for (const t of types) {
      const { container } = render(<PieceSprite type={t} color="w" />);
      expect(container.querySelector("svg")).toBeTruthy();
    }
  });
});
