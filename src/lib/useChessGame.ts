import { useCallback, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { GameStatus } from "../components/StatusBanner";
import type { TrackedPiece } from "../components/PieceLayer";
import { getAIMove } from "./ai";
import type { LmSettings } from "./ai";
import type { AppSettings } from "./settings";
import type { PieceType } from "./pieceSprites";

// Slide/fade duration must match the CSS transition in PieceLayer so captured
// pieces are removed only after their fade-out finishes, and the next AI move
// starts after the previous piece lands.
const ANIM_MS = 300;
// Extra pause between AI-vs-AI moves so the match is watchable.
const AI_VS_AI_PAUSE_MS = 350;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function computeStatus(game: Chess): { status: GameStatus; winner: "w" | "b" | null } {
  if (game.isCheckmate()) {
    // The side to move has been mated, so the other side won.
    return { status: "checkmate", winner: game.turn() === "w" ? "b" : "w" };
  }
  if (game.isStalemate()) return { status: "stalemate", winner: null };
  if (game.isDraw()) return { status: "draw", winner: null };
  if (game.isCheck()) return { status: "check", winner: null };
  return { status: "playing", winner: null };
}

// Build the tracked-piece list with fresh ids. Used at start and on new game;
// during play we never re-derive (that would break piece identity / animation) —
// we apply move deltas instead.
function toPieces(game: Chess): TrackedPiece[] {
  let id = 0;
  const out: TrackedPiece[] = [];
  game.board().forEach((row) =>
    row.forEach((c) => {
      if (c) out.push({ id: id++, type: c.type, color: c.color, square: c.square });
    })
  );
  return out;
}

// The chess.js move result fields we read to relocate pieces.
type MoveLike = {
  from: string;
  to: string;
  captured?: string;
  promotion?: string;
  flags: string;
};

// Pure piece-list delta for one move: relocate the mover, flag the captured piece
// (caller removes it after the fade), move the castling rook, and apply promotion.
// Keeps every surviving piece's id stable so the UI can animate the move.
export function applyPieceDelta(prev: TrackedPiece[], moved: MoveLike): TrackedPiece[] {
  const { from, to } = moved;
  const next = prev.map((p) => ({ ...p }));

  if (moved.captured) {
    // En passant: the captured pawn sits behind the destination square.
    const capSq = moved.flags.includes("e") ? `${to[0]}${from[1]}` : to;
    const victim = next.find((p) => p.square === capSq && !p.captured);
    if (victim) victim.captured = true;
  }

  const mover = next.find((p) => p.square === from && !p.captured);
  if (mover) {
    mover.square = to;
    if (moved.promotion) mover.type = moved.promotion as PieceType;
  }

  const rank = from[1];
  if (moved.flags.includes("k")) {
    const rook = next.find((p) => p.square === `h${rank}` && !p.captured);
    if (rook) rook.square = `f${rank}`;
  } else if (moved.flags.includes("q")) {
    const rook = next.find((p) => p.square === `a${rank}` && !p.captured);
    if (rook) rook.square = `d${rank}`;
  }

  return next;
}

export function useChessGame(settings: AppSettings) {
  const gameRef = useRef(new Chess());
  // Keep latest settings readable inside long-running async loops.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [pieces, setPieces] = useState<TrackedPiece[]>(() => toPieces(gameRef.current));
  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [winner, setWinner] = useState<"w" | "b" | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [matchRunning, setMatchRunning] = useState(false);
  const runningRef = useRef(false);

  const sync = useCallback(() => {
    const g = gameRef.current;
    setHistory(g.history());
    const s = computeStatus(g);
    setStatus(s.status);
    setWinner(s.winner);
  }, []);

  // Apply a move on chess.js, then delta-update the tracked pieces so each piece
  // keeps its id (and thus animates) across the move.
  const applyMove = useCallback((from: string, to: string) => {
    const g = gameRef.current;
    const moved = g.move({ from, to, promotion: "q" });
    if (!moved) return false;
    setPieces((prev) => applyPieceDelta(prev, moved));
    if (moved.captured) {
      setTimeout(() => setPieces((prev) => prev.filter((p) => !p.captured)), ANIM_MS);
    }
    return true;
  }, []);

  // Ask the given endpoint for the side-to-move's move and apply it.
  const playAIMove = useCallback(async (config: LmSettings) => {
    const g = gameRef.current;
    if (g.isGameOver()) return;
    const legal = g.moves();
    const san = await getAIMove(g.fen(), legal, config);
    const mv = g.moves({ verbose: true }).find((m) => m.san === san);
    if (mv) applyMove(mv.from, mv.to);
    sync();
  }, [applyMove, sync]);

  // Human mode: Black replies after the player (White) moves.
  const runBlackAI = useCallback(async () => {
    const g = gameRef.current;
    if (g.isGameOver() || g.turn() !== "b") return;
    setAiThinking(true);
    setAiError(null);
    try {
      await playAIMove(settingsRef.current.black);
    } catch {
      setAiError("Could not reach the Black AI. Check LM Studio is running and open Settings.");
    } finally {
      setAiThinking(false);
    }
  }, [playAIMove]);

  // AI-vs-AI: drive both sides until the game ends or the user stops it.
  const runMatch = useCallback(async () => {
    while (runningRef.current && !gameRef.current.isGameOver()) {
      const turn = gameRef.current.turn();
      const config = turn === "w" ? settingsRef.current.white : settingsRef.current.black;
      setAiThinking(true);
      setAiError(null);
      try {
        await playAIMove(config);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setAiError(`${turn === "w" ? "White" : "Black"} AI failed: ${msg}`);
        runningRef.current = false;
        break;
      } finally {
        setAiThinking(false);
      }
      if (!runningRef.current) break;
      await delay(ANIM_MS + AI_VS_AI_PAUSE_MS);
    }
    runningRef.current = false;
    setMatchRunning(false);
  }, [playAIMove]);

  const startMatch = useCallback(() => {
    if (runningRef.current || gameRef.current.isGameOver()) return;
    setSelected(null);
    setLegalTargets([]);
    runningRef.current = true;
    setMatchRunning(true);
    void runMatch();
  }, [runMatch]);

  const stopMatch = useCallback(() => {
    runningRef.current = false;
    setMatchRunning(false);
  }, []);

  const handleSquareClick = useCallback((sq: string) => {
    const g = gameRef.current;
    // No manual moves in AI-vs-AI mode or while an AI is moving.
    if (settingsRef.current.mode === "ai" || aiThinking || g.isGameOver() || g.turn() !== "w") return;
    const piece = g.get(sq as any);

    if (selected && legalTargets.includes(sq)) {
      applyMove(selected, sq);
      setSelected(null);
      setLegalTargets([]);
      sync();
      // Hand off to Black after the player's piece finishes sliding.
      setTimeout(() => { void runBlackAI(); }, ANIM_MS);
      return;
    }
    if (piece && piece.color === "w") {
      setSelected(sq);
      setLegalTargets(g.moves({ square: sq as any, verbose: true }).map((m) => m.to));
      return;
    }
    setSelected(null);
    setLegalTargets([]);
  }, [selected, legalTargets, aiThinking, applyMove, sync, runBlackAI]);

  // Re-trigger Black's reply after a failed attempt (human mode). No-op if it
  // isn't Black's turn or the game has ended.
  const retryAI = useCallback(() => {
    const g = gameRef.current;
    if (aiThinking || g.isGameOver() || g.turn() !== "b") return;
    setAiError(null);
    void runBlackAI();
  }, [aiThinking, runBlackAI]);

  const newGame = useCallback(() => {
    runningRef.current = false;
    setMatchRunning(false);
    gameRef.current = new Chess();
    setPieces(toPieces(gameRef.current));
    setSelected(null);
    setLegalTargets([]);
    setAiError(null);
    setAiThinking(false);
    sync();
  }, [sync]);

  return {
    pieces, selected, legalTargets, status, winner, history,
    aiError, aiThinking, matchRunning,
    handleSquareClick, newGame, retryAI, startMatch, stopMatch,
  };
}
