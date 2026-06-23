import type { PieceType } from "../lib/pieceSprites";
import { PIECE_GLYPHS } from "../lib/pieceSprites";

// Render a piece as a glyph inside an SVG <text>, so it scales crisply to fill
// whatever box it's placed in (the viewBox does the scaling — no font-size math).
// White = light fill + dark stroke; black = dark fill + light stroke, both with a
// soft drop shadow for depth.
export function PieceSprite({ type, color }: { type: PieceType; color: "w" | "b" }) {
  const fill = color === "w" ? "#f7f7f5" : "#2c2b29";
  const stroke = color === "w" ? "#33312e" : "#0c0c0c";
  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.35))" }}
      aria-label={`${color === "w" ? "white" : "black"} ${type}`}
    >
      <text
        x="50"
        y="54"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="80"
        fill={fill}
        stroke={stroke}
        strokeWidth={2.5}
        style={{ paintOrder: "stroke" }}
      >
        {PIECE_GLYPHS[type]}
      </text>
    </svg>
  );
}
