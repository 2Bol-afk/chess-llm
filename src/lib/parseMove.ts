// Match a model's free-text reply against the chess.js legal-move list.
// Returns the canonical legal SAN string, or null if no legal move appears.
export function parseMove(reply: string, legalMoves: string[]): string | null {
  if (!reply) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#=-]/g, "");
  const cleaned = norm(reply);

  // Prefer an exact normalized equality with any whole token in the reply.
  const tokens = reply.split(/\s+/).map(norm).filter(Boolean);
  for (const move of legalMoves) {
    const nm = norm(move);
    if (tokens.includes(nm)) return move;
  }
  // Fallback: the move appears as a substring of the cleaned reply.
  // Check longer moves first so "Qxd4+" wins over a stray "d4".
  for (const move of [...legalMoves].sort((a, b) => b.length - a.length)) {
    if (cleaned.includes(norm(move))) return move;
  }
  return null;
}
