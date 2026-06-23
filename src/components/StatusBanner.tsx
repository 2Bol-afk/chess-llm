export type GameStatus = "playing" | "check" | "checkmate" | "stalemate" | "draw";

export function StatusBanner({
  status,
  aiError,
  winner,
}: {
  status: GameStatus;
  aiError: string | null;
  winner: "w" | "b" | null;
}) {
  if (aiError) {
    return <div className="text-red-600 font-bold">⚠ {aiError}</div>;
  }
  const side = winner === "w" ? "White" : winner === "b" ? "Black" : "";
  const text =
    status === "checkmate" ? `Checkmate — ${side} wins!`
    : status === "stalemate" ? "Stalemate — draw"
    : status === "draw" ? "Draw"
    : status === "check" ? "Check!"
    : "Your move";
  return <div className="font-bold">{text}</div>;
}
