# 8-Bit Chess vs. Gemma — Design Spec

**Date:** 2026-06-23
**Status:** Approved design, pending spec review

## Summary

A single-page chess game where the user plays White (manually) against a local
Gemma model served by LM Studio (Black). The board and pieces use a code-drawn
8-bit pixel-art style. Captures play a themed per-piece "spell" animation instead
of the piece simply vanishing. Beginner-friendly: clicking a piece shows dots on
every legal destination square.

## Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- chess.js — sole rules authority (legality, check/mate/draw, FEN)
- No image-gen, no new runtime deps beyond the above. Pixel art is hand-coded SVG;
  capture effects are CSS keyframes.

## Decisions (locked)

- **Rules engine:** chess.js. No hand-rolled rules.
- **LLM transport:** direct `fetch` from the browser to LM Studio's
  OpenAI-compatible endpoint. No backend proxy.
- **Illegal AI moves:** constrain + retry. Gemma chooses from a chess.js-generated
  legal-move list; up to 3 attempts with feedback; random legal move as final fallback.
- **Move input:** click-click. Click piece → dots on legal targets → click dot to move.
- **Art:** code-drawn SVG pixel sprites, 12 sprites (6 types × 2 colors).
- **Scope:** bare minimum — board, dots, click-to-move, AI opponent, check/mate/
  stalemate/draw detection, move history, new game, settings dialog, capture effects.
  No undo, flip, captured-tray, sound, or clock in v1.
- **Player color:** always White; Gemma always Black.
- **LM Studio config:** shadcn settings dialog (base URL + model name), persisted to
  localStorage. Defaults: `http://localhost:1234/v1`, model name user-supplied.
- **Capture mechanic:** visual only. chess.js stays the single source of truth — no
  gameplay-altering abilities. Each of the 6 piece types gets its own themed
  capture animation.

## Architecture

### State (in `App.tsx`)

- `game` — a `Chess` instance in a `useRef` (chess.js mutates in place)
- `fen` — string state, bumped after every move to force re-render
- `selectedSquare` — square the player clicked, or `null`
- `legalTargets` — `to`-squares to show dots on, from `game.moves({square, verbose:true})`
- `status` — `'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw'`
- `history` — array of SAN move strings for the side panel
- `activeEffects` — array of `{id, square, type, color}` for in-flight capture animations
- `settings` — `{baseUrl, model}`, persisted to localStorage
- `aiThinking` — boolean, disables input while Gemma is choosing

### Components

- `Board` — 8×8 grid; renders `Square` cells, piece sprites, dot overlays, click handlers
- `PieceSprite` — code-drawn SVG per piece type/color (pixel-grid 8-bit style)
- `CaptureEffectLayer` — overlay rendering one effect per `activeEffects` entry
- `MoveHistory` — scrollable list of SAN moves
- `StatusBanner` — check / checkmate / stalemate / draw / AI-error text
- `SettingsDialog` — shadcn Dialog; base URL + model name fields
- `lib/ai.ts` — `getAIMove(fen, legalMoves, settings) => Promise<string>`
- `lib/pieceSprites.ts` — SVG pixel-grid defs per piece/color
- `lib/captureEffects.ts` — CSS keyframe defs per piece type

### File layout

```
src/
  App.tsx
  components/
    Board.tsx
    PieceSprite.tsx
    CaptureEffectLayer.tsx
    MoveHistory.tsx
    StatusBanner.tsx
    SettingsDialog.tsx
  lib/
    ai.ts
    pieceSprites.ts
    captureEffects.ts
```

## Interaction: click-to-move + dots

1. Click own piece → `game.moves({square, verbose:true})` → set `legalTargets` to the
   resulting `to` squares → render a dot on each.
2. Click a dot square → apply the move (see capture flow below) → clear selection →
   trigger AI turn.
3. Click another own piece while one is selected → reselect.
4. Click empty/opponent square with nothing selected → no-op.
5. Pawn reaching the last rank auto-promotes to queen (simplest default).

Input is disabled while `aiThinking` is true.

## Capture flow + effects

Before applying any move, check if it is a capture (`game.get(toSquare)` is occupied
by the opponent, or it's an en-passant target). If so:

1. Read the captured piece's `{type, color, square}`.
2. Push `{id, square, type, color}` onto `activeEffects`.
3. `CaptureEffectLayer` renders that effect, absolutely positioned over the square.
4. On `onAnimationEnd`, remove the entry from `activeEffects` — self-cleaning, no timers.

Each piece type gets its own ~500ms CSS-keyframe animation built from simple pixel
shapes (no new libs):

- pawn — small puff
- knight — slash streak
- bishop — sparkle / teleport
- rook — crumble
- queen — radiant burst
- king — large burst (included for symmetry; unreachable in normal play since
  checkmate ends the game before the king is captured)

The capture is still a normal chess.js move — the effect is purely cosmetic.

## AI move selection (`lib/ai.ts`)

Lean on chess.js so "validate a move" collapses to "is this string in an array."

1. `legalMoves = game.moves()` → SAN strings (e.g. `["Nf6","e5","d5", ...]`).
2. Prompt Gemma: *"You are playing Black. Board FEN: `<fen>`. Choose exactly one move
   from this list: `[...]`. Reply with only that move, nothing else."*
3. Parse reply: trim, strip punctuation, case-insensitive match against `legalMoves`.
4. Match → return it.
5. No match → retry (max 3 attempts total), telling Gemma its last reply wasn't in the list.
6. Still no match → return a random legal move (game never hangs).

Transport: `POST ${settings.baseUrl}/chat/completions`, OpenAI-compatible chat schema,
`model = settings.model`, low temperature. Connection errors (LM Studio not running)
surface in `StatusBanner` as a readable message rather than crashing; the turn does not
advance and the user can open settings / start LM Studio and retry.

## Game-over handling

After every move (player and AI), evaluate in order:
`isCheckmate()` → `isStalemate()` → `isDraw()` (insufficient material, 50-move,
threefold) → `isCheck()` → else `playing`. `StatusBanner` reflects the result.
"New Game" resets `game.reset()` and clears history, effects, selection, and status.

## Error handling summary

- LM Studio unreachable / HTTP error → status message, turn does not advance, retryable.
- Malformed / illegal AI reply → retry loop, then random legal move.
- Invalid user clicks → no-op (guarded by `legalTargets`).

## Out of scope (v1)

Undo, board flip, captured-pieces tray, sound effects, move clock, color selection,
multiplayer, persistence of game state across reloads, real gameplay-altering piece abilities.

## Self-check

Non-trivial logic that needs a runnable check: the AI reply parser
(`parseMove(reply, legalMoves)`) — assert that exact matches, case/whitespace/punctuation
variants match, and unmatched replies return null. One small test alongside `lib/ai.ts`.
