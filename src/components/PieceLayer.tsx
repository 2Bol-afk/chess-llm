import { PieceSprite } from "./PieceSprite";
import type { PieceType } from "../lib/pieceSprites";

export type TrackedPiece = {
  id: number;
  type: PieceType;
  color: "w" | "b";
  square: string;
  captured?: boolean;
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

// Square -> top-left percentage of the board (rank 8 at top, a-file left).
function squarePos(sq: string): { left: number; top: number } {
  const col = FILES.indexOf(sq[0]);
  const row = 8 - Number(sq[1]);
  return { left: col * 12.5, top: row * 12.5 };
}

// Pieces live in one absolute layer (not inside the squares) so each keeps a
// stable DOM node across moves — the CSS transition on left/top then animates the
// piece sliding from one square to the next. Captured pieces fade + shrink in place.
export function PieceLayer({ pieces }: { pieces: TrackedPiece[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {pieces.map((p) => {
        const { left, top } = squarePos(p.square);
        return (
          <div
            key={p.id}
            data-piece={p.id}
            className="absolute"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: "12.5%",
              height: "12.5%",
              transition:
                "left 0.28s cubic-bezier(0.22,0.61,0.36,1), top 0.28s cubic-bezier(0.22,0.61,0.36,1), opacity 0.28s ease, transform 0.28s ease",
              opacity: p.captured ? 0 : 1,
              transform: p.captured ? "scale(0.4)" : "scale(1)",
              zIndex: p.captured ? 5 : 10,
            }}
          >
            <PieceSprite type={p.type} color={p.color} />
          </div>
        );
      })}
    </div>
  );
}
