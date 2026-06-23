import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Chess } from "chess.js";
import { applyPieceDelta, computeStatus, useChessGame } from "./useChessGame";
import type { TrackedPiece } from "../components/PieceLayer";

const wp = (id: number, square: string, color: "w" | "b" = "w", type: TrackedPiece["type"] = "p"): TrackedPiece =>
  ({ id, square, color, type });

describe("applyPieceDelta", () => {
  it("relocates the mover and keeps the count on a quiet move", () => {
    const next = applyPieceDelta([wp(0, "e2")], { from: "e2", to: "e4", flags: "b" });
    expect(next).toHaveLength(1);
    expect(next[0].square).toBe("e4");
    expect(next[0].captured).toBeUndefined();
  });

  it("flags the captured piece and moves the attacker onto its square", () => {
    const next = applyPieceDelta(
      [wp(0, "d4", "w"), wp(1, "e5", "b")],
      { from: "d4", to: "e5", captured: "p", flags: "c" }
    );
    expect(next.find((p) => p.id === 0)!.square).toBe("e5");
    expect(next.find((p) => p.id === 1)!.captured).toBe(true);
  });

  it("flags the en-passant pawn behind the destination square", () => {
    const next = applyPieceDelta(
      [wp(0, "e5", "w"), wp(1, "d5", "b")],
      { from: "e5", to: "d6", captured: "p", flags: "e" }
    );
    expect(next.find((p) => p.id === 0)!.square).toBe("d6");
    expect(next.find((p) => p.id === 1)!.captured).toBe(true); // pawn was on d5, not d6
  });

  it("moves the rook on kingside castling", () => {
    const next = applyPieceDelta(
      [wp(0, "e1", "w", "k"), wp(1, "h1", "w", "r")],
      { from: "e1", to: "g1", flags: "k" }
    );
    expect(next.find((p) => p.id === 0)!.square).toBe("g1");
    expect(next.find((p) => p.id === 1)!.square).toBe("f1");
  });

  it("promotes the mover", () => {
    const next = applyPieceDelta([wp(0, "a7")], { from: "a7", to: "a8", promotion: "q", flags: "np" });
    expect(next[0].square).toBe("a8");
    expect(next[0].type).toBe("q");
  });
});

describe("computeStatus", () => {
  it("reports playing at game start", () => {
    expect(computeStatus(new Chess())).toEqual({ status: "playing", winner: null });
  });
  it("reports checkmate with the mating side as winner (fool's mate)", () => {
    const g = new Chess();
    g.move("f3"); g.move("e5"); g.move("g4"); g.move("Qh4#");
    expect(computeStatus(g)).toEqual({ status: "checkmate", winner: "b" });
  });
});

describe("piece tracking", () => {
  const settings = {
    mode: "human" as const,
    white: { baseUrl: "http://localhost:1234/v1", model: "test-model" },
    black: { baseUrl: "http://localhost:1234/v1", model: "test-model" },
  };

  it("starts with 32 pieces and relocates the mover on the player's move", () => {
    // Fake timers so the post-move AI handoff timer never fires (we assert the
    // piece state synchronously) — otherwise it would leak into later tests.
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useChessGame(settings));
      expect(result.current.pieces).toHaveLength(32);

      act(() => { result.current.handleSquareClick("e2"); });
      act(() => { result.current.handleSquareClick("e4"); });

      const live = result.current.pieces.filter((p) => !p.captured);
      expect(live.some((p) => p.square === "e4")).toBe(true);
      expect(live.some((p) => p.square === "e2")).toBe(false);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});

describe("AI vs AI match", () => {
  const aiSettings = {
    mode: "ai" as const,
    white: { baseUrl: "http://localhost:1234/v1", model: "white-ai" },
    black: { baseUrl: "http://192.168.1.50:1234/v1", model: "black-ai" },
  };

  it("drives both sides until stopped, hitting the configured endpoints", async () => {
    // Reply is unparseable, so getAIMove falls back to a random legal move —
    // enough to advance the game without us needing to know each position.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "(thinking)" } }] }),
    } as Response);

    const { result } = renderHook(() => useChessGame(aiSettings));
    act(() => { result.current.startMatch(); });

    // Both sides keep moving on their own.
    await waitFor(() => expect(result.current.history.length).toBeGreaterThanOrEqual(2), { timeout: 4000 });

    // Both endpoints were called.
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.startsWith("http://localhost:1234/v1"))).toBe(true);
    expect(urls.some((u) => u.startsWith("http://192.168.1.50:1234/v1"))).toBe(true);

    act(() => { result.current.stopMatch(); });
    expect(result.current.matchRunning).toBe(false);
    fetchSpy.mockRestore();
  });
});

describe("retryAI", () => {
  const settings = {
    mode: "human" as const,
    white: { baseUrl: "http://localhost:1234/v1", model: "test-model" },
    black: { baseUrl: "http://localhost:1234/v1", model: "test-model" },
  };

  it("is a no-op when it isn't Black's turn", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { result } = renderHook(() => useChessGame(settings));

    // Fresh game: White to move, so retryAI must not touch the network or state.
    act(() => { result.current.retryAI(); });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.aiError).toBeNull();
    fetchSpy.mockRestore();
  });

  it("clears aiError and re-runs the AI turn after LM Studio comes back up", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useChessGame(settings));

    // Player makes a move; the post-move AI turn fires and fails (LM Studio unreachable).
    act(() => { result.current.handleSquareClick("e2"); });
    act(() => { result.current.handleSquareClick("e4"); });
    await waitFor(() => expect(result.current.aiError).not.toBeNull());
    expect(result.current.history).toHaveLength(1); // only White's move applied

    // LM Studio is back: retry should clear the error and let Black move.
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "e5" } }] }),
    } as Response);

    act(() => { result.current.retryAI(); });
    expect(result.current.aiError).toBeNull();

    await waitFor(() => expect(result.current.history).toHaveLength(2));
    expect(result.current.history[1]).toBe("e5");

    fetchSpy.mockRestore();
  });
});
