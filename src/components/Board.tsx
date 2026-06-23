import type { PieceType } from "../lib/pieceSprites";

export type BoardPiece = { square: string; type: PieceType; color: "w" | "b" } | null;

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

// chess.js board() returns rank 8 first (index 0) down to rank 1 (index 7).
function squareName(rowIdx: number, colIdx: number): string {
  return `${FILES[colIdx]}${8 - rowIdx}`;
}

// Board renders the squares, the selection highlight, and the legal-move dots.
// Pieces are rendered separately in PieceLayer (overlaid) so they can animate
// independently of the static grid.
export function Board({
  selected,
  legalTargets,
  occupied,
  onSquareClick,
}: {
  selected: string | null;
  legalTargets: string[];
  occupied: (sq: string) => boolean;
  onSquareClick: (sq: string) => void;
}) {
  const rows = Array.from({ length: 8 });
  const cols = Array.from({ length: 8 });
  return (
    <div className="grid grid-cols-8 aspect-square w-full max-w-[560px] relative select-none rounded-lg overflow-hidden shadow-2xl ring-1 ring-black/30">
      {rows.map((_, r) =>
        cols.map((__, c) => {
          const sq = squareName(r, c);
          const dark = (r + c) % 2 === 1;
          const isSel = selected === sq;
          const isTarget = legalTargets.includes(sq);
          const hasPiece = occupied(sq);
          return (
            <div
              key={sq}
              data-square={sq}
              onClick={() => onSquareClick(sq)}
              className={`relative flex items-center justify-center cursor-pointer ${
                dark ? "bg-[#769656]" : "bg-[#eeeed2]"
              } ${isSel ? "after:absolute after:inset-0 after:bg-yellow-300/40" : ""}`}
            >
              {isTarget && (
                <span
                  data-dot
                  className={`absolute rounded-full pointer-events-none ${
                    hasPiece
                      ? "w-full h-full border-[6px] border-black/25"
                      : "w-1/3 h-1/3 bg-black/25"
                  }`}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
