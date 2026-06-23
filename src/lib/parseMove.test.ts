import { describe, it, expect } from "vitest";
import { parseMove } from "./parseMove";

const legal = ["Nf6", "e5", "d5", "O-O", "Qxd4+"];

describe("parseMove", () => {
  it("matches an exact move", () => {
    expect(parseMove("Nf6", legal)).toBe("Nf6");
  });
  it("ignores surrounding whitespace and quotes", () => {
    expect(parseMove('  "e5" ', legal)).toBe("e5");
  });
  it("matches case-insensitively but returns canonical casing", () => {
    expect(parseMove("nf6", legal)).toBe("Nf6");
  });
  it("strips trailing punctuation/prose around the move", () => {
    expect(parseMove("I'll play d5.", legal)).toBe("d5");
  });
  it("matches castling and check notation", () => {
    expect(parseMove("o-o", legal)).toBe("O-O");
    expect(parseMove("Qxd4+", legal)).toBe("Qxd4+");
  });
  it("returns null when nothing matches", () => {
    expect(parseMove("Ke2", legal)).toBeNull();
    expect(parseMove("", legal)).toBeNull();
  });
});
