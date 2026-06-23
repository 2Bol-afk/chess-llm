import { useMemo, useState } from "react";
import { Board } from "./components/Board";
import { PieceLayer } from "./components/PieceLayer";
import { MoveHistory } from "./components/MoveHistory";
import { StatusBanner } from "./components/StatusBanner";
import { SettingsDialog } from "./components/SettingsDialog";
import { useChessGame } from "./lib/useChessGame";
import { loadSettings, saveSettings } from "./lib/settings";
import type { AppSettings } from "./lib/settings";

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const game = useChessGame(settings);
  const isAiVsAi = settings.mode === "ai";

  // Which squares are occupied (by a non-captured piece) — drives dot styling.
  const occupiedSet = useMemo(
    () => new Set(game.pieces.filter((p) => !p.captured).map((p) => p.square)),
    [game.pieces]
  );

  return (
    <div className="min-h-full bg-gradient-to-b from-[#262421] to-[#1a1816] text-white flex flex-col items-center gap-6 p-4 sm:p-8">
      <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent">
        Chess <span className="text-white/60 font-medium">{isAiVsAi ? "AI vs AI" : "vs Gemma"}</span>
      </h1>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="relative w-[min(90vw,560px)] shrink-0">
          <Board
            selected={game.selected}
            legalTargets={game.legalTargets}
            occupied={(sq) => occupiedSet.has(sq)}
            onSquareClick={game.handleSquareClick}
          />
          <PieceLayer pieces={game.pieces} />
        </div>

        <div className="w-56 space-y-3">
          <StatusBanner status={game.status} aiError={game.aiError} winner={game.winner} />
          {game.aiThinking && (
            <div className="text-emerald-300 text-sm animate-pulse">
              {isAiVsAi ? `${game.matchRunning ? "Thinking" : "…"}` : "Gemma is thinking…"}
            </div>
          )}

          {isAiVsAi ? (
            <button
              className="w-full px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              onClick={game.matchRunning ? game.stopMatch : game.startMatch}
              disabled={game.status !== "playing" && game.status !== "check"}
            >
              {game.matchRunning ? "Stop match" : "Start match"}
            </button>
          ) : (
            game.aiError && (
              <button
                className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50"
                onClick={game.retryAI}
                disabled={game.aiThinking}
              >
                Retry AI move
              </button>
            )
          )}

          <div className="flex gap-2">
            <button className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500" onClick={game.newGame}>New Game</button>
            <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20" onClick={() => setShowSettings(true)}>Settings</button>
          </div>
          <MoveHistory moves={game.history} />
        </div>
      </div>

      <SettingsDialog
        open={showSettings}
        settings={settings}
        onSave={(s) => { setSettings(s); saveSettings(s); }}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
