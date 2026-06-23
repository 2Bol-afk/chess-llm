export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

// Unicode chess glyphs. We use the SOLID (filled) glyph set for BOTH colors and
// recolor per side at render time — the outline white glyphs (♔♕…) render thin
// and inconsistent across fonts, so filled-plus-recolor reads cleaner and more
// modern. ponytail: glyphs over bundled SVG piece packs — no asset/licensing weight.
export const PIECE_GLYPHS: Record<PieceType, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};
