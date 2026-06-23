# 8-Bit Chess vs. Gemma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-page web chess game where the user plays White by click-to-move (with legal-move dot hints) against a local Gemma model served by LM Studio (Black), in an 8-bit pixel-art style, with themed per-piece capture animations.

**Architecture:** React + Vite SPA. chess.js is the sole rules authority (legality, check/mate/draw, FEN). The AI opponent is asked to pick from a chess.js-generated legal-move list and re-prompted on failure, falling back to a random legal move so the game never hangs. Pieces are hand-coded SVG pixel sprites; captures play CSS-keyframe animations. No backend — the browser fetches LM Studio's OpenAI-compatible endpoint directly.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, shadcn/ui, chess.js, Vitest.

## Global Constraints

- Player is always White; Gemma is always Black. White moves first.
- chess.js is the only source of game rules. No hand-rolled legality. Capture effects are cosmetic only — never alter game state beyond a normal chess.js move.
- LLM transport: direct browser `fetch` to `${baseUrl}/chat/completions`, OpenAI-compatible chat schema. No backend proxy.
- LM Studio config (`baseUrl`, `model`) is user-editable via a shadcn dialog and persisted to `localStorage` under key `chess-lm-settings`. Default `baseUrl`: `http://localhost:1234/v1`. Default `model`: `""` (empty — user must set).
- Pawn promotion auto-selects queen.
- Out of scope (do not build): undo, board flip, captured-pieces tray, sound, clock, color selection, multiplayer, game-state persistence, gameplay-altering piece abilities.
- Each piece type gets its own capture animation: pawn, knight, bishop, rook, queen, king.

---

### Task 1: Scaffold Vite + React + TS + Tailwind + Vitest

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `tailwind.config.js`, `postcss.config.js`, `vitest.config.ts`, `.gitignore`

**Interfaces:**
- Produces: a runnable dev server (`npm run dev`) and a passing test runner (`npm test`).

- [ ] **Step 1: Scaffold the Vite React-TS project into the current directory**

Run:
```bash
npm create vite@latest . -- --template react-ts
```
If prompted about a non-empty directory (the `docs/` folder exists), choose "Ignore files and continue".

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install
npm install chess.js
npm install -D tailwindcss@^3 postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind content paths**

Replace `tailwind.config.js` with:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 4: Set Tailwind directives in `src/index.css`**

Replace `src/index.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; margin: 0; }
img, svg { image-rendering: pixelated; }
```

- [ ] **Step 5: Add Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
});
```

Add to `package.json` `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 6: Minimal App placeholder**

Replace `src/App.tsx`:
```tsx
export default function App() {
  return <div className="p-4 text-xl">8-Bit Chess</div>;
}
```

- [ ] **Step 7: Verify dev server and tests run**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

Run: `npm test`
Expected: Vitest runs and reports "no test files found" (exit 0) — runner works.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React TS + Tailwind + Vitest"
```

---

### Task 2: AI move parser (`parseMove`)

This is the core testable logic — collapse "validate a chess move" into "is this string in the legal-move list".

**Files:**
- Create: `src/lib/parseMove.ts`
- Test: `src/lib/parseMove.test.ts`

**Interfaces:**
- Produces: `parseMove(reply: string, legalMoves: string[]): string | null` — returns the matching legal SAN move (original casing from `legalMoves`) or `null` if no match.

- [ ] **Step 1: Write the failing test**

Create `src/lib/parseMove.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseMove } from "./parseMove";

const legal = ["Nf6", "e5", "d5", "O-O", "Qxd4+"];

describe("parseMove", () => {
  it("matches an exact move", () => {
    expect(parseMove("Nf6", legal)).toBe("Nf6");
  });
  it("ignores surrounding whitespace and quotes", () => {
    expect(parseMove('  "e5" ', legal)).toBe("e5");
  });
  it("matches case-insensitively but returns canonical casing", () => {
    expect(parseMove("nf6", legal)).toBe("Nf6");
  });
  it("strips trailing punctuation/prose around the move", () => {
    expect(parseMove("I'll play d5.", legal)).toBe("d5");
  });
  it("matches castling and check notation", () => {
    expect(parseMove("o-o", legal)).toBe("O-O");
    expect(parseMove("Qxd4+", legal)).toBe("Qxd4+");
  });
  it("returns null when nothing matches", () => {
    expect(parseMove("Ke2", legal)).toBeNull();
    expect(parseMove("", legal)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/parseMove.test.ts`
Expected: FAIL — `parseMove` not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/parseMove.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/parseMove.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parseMove.ts src/lib/parseMove.test.ts
git commit -m "feat: add AI reply move parser"
```

---

### Task 3: AI move client (`getAIMove`)

**Files:**
- Create: `src/lib/ai.ts`
- Test: `src/lib/ai.test.ts`

**Interfaces:**
- Consumes: `parseMove` from `./parseMove`.
- Produces:
  - `type LmSettings = { baseUrl: string; model: string }`
  - `getAIMove(fen: string, legalMoves: string[], settings: LmSettings, fetchImpl?: typeof fetch): Promise<string>` — resolves to a legal SAN move. Retries up to 3 chat calls; if all fail to parse, returns a random move from `legalMoves`. Throws only on network/HTTP errors (LM Studio unreachable).

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { getAIMove, LmSettings } from "./ai";

const settings: LmSettings = { baseUrl: "http://x/v1", model: "gemma" };
const legal = ["e5", "Nf6", "d5"];

function mockReply(content: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response);
}

describe("getAIMove", () => {
  it("returns a legal move the model picked", async () => {
    const f = mockReply("Nf6");
    const move = await getAIMove("fen", legal, settings, f as unknown as typeof fetch);
    expect(move).toBe("Nf6");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("falls back to a legal move after repeated bad replies", async () => {
    const f = mockReply("xyz illegal");
    const move = await getAIMove("fen", legal, settings, f as unknown as typeof fetch);
    expect(legal).toContain(move);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("throws when the endpoint errors", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(
      getAIMove("fen", legal, settings, f as unknown as typeof fetch)
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai.test.ts`
Expected: FAIL — `getAIMove` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai.ts`:
```ts
import { parseMove } from "./parseMove";

export type LmSettings = { baseUrl: string; model: string };

const MAX_ATTEMPTS = 3;

function buildMessages(fen: string, legalMoves: string[], lastBad?: string) {
  const system =
    "You are a chess engine playing Black. Reply with ONLY one move in " +
    "standard algebraic notation, exactly as it appears in the provided list. " +
    "No explanation, no extra text.";
  let user =
    `Board FEN: ${fen}\n` +
    `Legal moves: ${legalMoves.join(", ")}\n` +
    `Choose exactly one move from that list.`;
  if (lastBad) {
    user += `\nYour previous reply "${lastBad}" was not in the list. Pick one from the list.`;
  }
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export async function getAIMove(
  fen: string,
  legalMoves: string[],
  settings: LmSettings,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  let lastBad: string | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetchImpl(`${settings.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.2,
        messages: buildMessages(fen, legalMoves, lastBad),
      }),
    });
    if (!res.ok) {
      throw new Error(`LM Studio request failed: ${res.status}`);
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const match = parseMove(content, legalMoves);
    if (match) return match;
    lastBad = content.slice(0, 40);
  }
  // ponytail: random legal move so the game never hangs on a stubborn model
  return legalMoves[Math.floor(Math.random() * legalMoves.length)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai.ts src/lib/ai.test.ts
git commit -m "feat: add LM Studio AI move client with retry + fallback"
```

---

### Task 4: Piece sprites (`PieceSprite`)

**Files:**
- Create: `src/lib/pieceSprites.tsx`
- Create: `src/components/PieceSprite.tsx`
- Test: `src/components/PieceSprite.test.tsx`

**Interfaces:**
- Consumes: chess.js piece shape `{ type: 'p'|'n'|'b'|'r'|'q'|'k', color: 'w'|'b' }`.
- Produces: `<PieceSprite type={PieceType} color={'w'|'b'} />` returning an inline SVG. `type PieceType = 'p'|'n'|'b'|'r'|'q'|'k'`.

- [ ] **Step 1: Write the failing test**

Create `src/components/PieceSprite.test.tsx`:
```tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PieceSprite } from "./PieceSprite";

describe("PieceSprite", () => {
  it("renders an svg for each piece type", () => {
    const types = ["p", "n", "b", "r", "q", "k"] as const;
    for (const t of types) {
      const { container } = render(<PieceSprite type={t} color="w" />);
      expect(container.querySelector("svg")).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PieceSprite.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the pixel-grid sprite data**

Create `src/lib/pieceSprites.tsx`. Each piece is an 8×8 grid string where `#` = filled pixel, ` ` = empty. Colors are applied at render time (white piece = light fill + dark outline, black piece = dark fill + light outline). Use simple recognizable silhouettes:
```tsx
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

// 8x8 pixel masks. '#' = body pixel. Kept deliberately simple/blocky (8-bit).
export const PIECE_MASKS: Record<PieceType, string[]> = {
  p: [
    "        ",
    "   ##   ",
    "  ####  ",
    "   ##   ",
    "  ####  ",
    " ###### ",
    " ###### ",
    "        ",
  ],
  n: [
    "  ####  ",
    " ###### ",
    "#### ## ",
    "   #### ",
    "  ##### ",
    " ###### ",
    " ###### ",
    "        ",
  ],
  b: [
    "   ##   ",
    "  ####  ",
    "  #  #  ",
    "  ####  ",
    "  ####  ",
    " ###### ",
    " ###### ",
    "        ",
  ],
  r: [
    " # ## # ",
    " ###### ",
    "  ####  ",
    "  ####  ",
    "  ####  ",
    " ###### ",
    " ###### ",
    "        ",
  ],
  q: [
    "# #  # #",
    "########",
    " ###### ",
    "  ####  ",
    "  ####  ",
    " ###### ",
    "########",
    "        ",
  ],
  k: [
    "   ##   ",
    "   ##   ",
    " ###### ",
    "########",
    " ###### ",
    "  ####  ",
    " ###### ",
    "########",
  ],
};
```

- [ ] **Step 4: Write the component**

Create `src/components/PieceSprite.tsx`:
```tsx
import { PIECE_MASKS, PieceType } from "../lib/pieceSprites";

export function PieceSprite({ type, color }: { type: PieceType; color: "w" | "b" }) {
  const fill = color === "w" ? "#f4f4f4" : "#2b2b2b";
  const outline = color === "w" ? "#2b2b2b" : "#f4f4f4";
  const mask = PIECE_MASKS[type];
  const rects: JSX.Element[] = [];
  mask.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "#") {
        rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
      }
    });
  });
  return (
    <svg viewBox="0 0 8 8" width="100%" height="100%" shapeRendering="crispEdges"
         style={{ filter: `drop-shadow(0.3px 0 ${outline}) drop-shadow(0 0.3px ${outline})` }}>
      {rects}
    </svg>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/PieceSprite.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pieceSprites.tsx src/components/PieceSprite.tsx src/components/PieceSprite.test.tsx
git commit -m "feat: add 8-bit SVG piece sprites"
```

---

### Task 5: Capture effects (`CaptureEffectLayer`)

**Files:**
- Create: `src/lib/captureEffects.ts`
- Create: `src/components/CaptureEffectLayer.tsx`
- Test: `src/components/CaptureEffectLayer.test.tsx`

**Interfaces:**
- Consumes: `PieceType` from `../lib/pieceSprites`.
- Produces:
  - `type CaptureEffect = { id: number; square: string; type: PieceType; color: "w" | "b" }`
  - `<CaptureEffectLayer effects={CaptureEffect[]} squareToXY={(sq:string)=>{left:string;top:string}} onDone={(id:number)=>void} />`
  - Each effect renders a div with a per-type animation class; calls `onDone(id)` on `animationend`.

- [ ] **Step 1: Write the failing test**

Create `src/components/CaptureEffectLayer.test.tsx`:
```tsx
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CaptureEffectLayer } from "./CaptureEffectLayer";

describe("CaptureEffectLayer", () => {
  it("renders one node per effect and fires onDone on animationend", () => {
    const onDone = vi.fn();
    const { container } = render(
      <CaptureEffectLayer
        effects={[{ id: 1, square: "e4", type: "q", color: "b" }]}
        squareToXY={() => ({ left: "0px", top: "0px" })}
        onDone={onDone}
      />
    );
    const node = container.querySelector("[data-effect]") as HTMLElement;
    expect(node).toBeTruthy();
    fireEvent.animationEnd(node);
    expect(onDone).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CaptureEffectLayer.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the per-type effect CSS**

Create `src/lib/captureEffects.ts`:
```ts
import { PieceType } from "./pieceSprites";

// Maps each piece type to a CSS animation class defined in captureEffects.css.
export const EFFECT_CLASS: Record<PieceType, string> = {
  p: "fx-pawn",
  n: "fx-knight",
  b: "fx-bishop",
  r: "fx-rook",
  q: "fx-queen",
  k: "fx-king",
};
```

Create `src/components/captureEffects.css`:
```css
.fx { position: absolute; pointer-events: none; z-index: 20; }
.fx-pawn   { animation: puff 0.5s steps(4) forwards; background: #ffd; border-radius: 50%; }
.fx-knight { animation: slash 0.5s steps(4) forwards; background: #cdf; }
.fx-bishop { animation: sparkle 0.6s steps(5) forwards; background: #fcf; border-radius: 50%; }
.fx-rook   { animation: crumble 0.5s steps(4) forwards; background: #dcb; }
.fx-queen  { animation: burst 0.6s steps(5) forwards; background: #fdd; border-radius: 50%; }
.fx-king   { animation: bigburst 0.7s steps(6) forwards; background: #fee; border-radius: 50%; }

@keyframes puff    { from { transform: scale(0.4); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
@keyframes slash   { from { transform: rotate(-20deg) scaleX(0.2); opacity: 1; } to { transform: rotate(30deg) scaleX(1.6); opacity: 0; } }
@keyframes sparkle { from { transform: scale(0.2) rotate(0deg); opacity: 1; } to { transform: scale(1.5) rotate(180deg); opacity: 0; } }
@keyframes crumble { from { transform: translateY(0) scale(1); opacity: 1; } to { transform: translateY(40%) scale(0.6); opacity: 0; } }
@keyframes burst   { from { transform: scale(0.3); opacity: 1; } to { transform: scale(2); opacity: 0; } }
@keyframes bigburst{ from { transform: scale(0.3); opacity: 1; } to { transform: scale(2.6); opacity: 0; } }
```

- [ ] **Step 4: Write the component**

Create `src/components/CaptureEffectLayer.tsx`:
```tsx
import { PieceType } from "../lib/pieceSprites";
import { EFFECT_CLASS } from "../lib/captureEffects";
import "./captureEffects.css";

export type CaptureEffect = {
  id: number;
  square: string;
  type: PieceType;
  color: "w" | "b";
};

export function CaptureEffectLayer({
  effects,
  squareToXY,
  onDone,
}: {
  effects: CaptureEffect[];
  squareToXY: (sq: string) => { left: string; top: string };
  onDone: (id: number) => void;
}) {
  return (
    <>
      {effects.map((e) => {
        const pos = squareToXY(e.square);
        return (
          <div
            key={e.id}
            data-effect
            className={`fx ${EFFECT_CLASS[e.type]}`}
            style={{ left: pos.left, top: pos.top, width: "12.5%", height: "12.5%" }}
            onAnimationEnd={() => onDone(e.id)}
          />
        );
      })}
    </>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/CaptureEffectLayer.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/captureEffects.ts src/components/captureEffects.css src/components/CaptureEffectLayer.tsx src/components/CaptureEffectLayer.test.tsx
git commit -m "feat: add per-piece capture effect layer"
```

---

### Task 6: Board with click-to-move and dot hints

**Files:**
- Create: `src/components/Board.tsx`
- Test: `src/components/Board.test.tsx`

**Interfaces:**
- Consumes: `PieceSprite`; chess.js `Square` strings (e.g. `"e4"`).
- Produces:
  - `type BoardPiece = { square: string; type: PieceType; color: "w" | "b" } | null` per cell
  - `<Board board={(BoardPiece)[][]} selected={string|null} legalTargets={string[]} onSquareClick={(sq:string)=>void} />`
  - Renders 64 cells; a cell in `legalTargets` shows a dot (`[data-dot]`); the `selected` cell is highlighted. Squares are addressable via `data-square` attribute.

- [ ] **Step 1: Write the failing test**

Create `src/components/Board.test.tsx`:
```tsx
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Board } from "./Board";
import { Chess } from "chess.js";

function freshBoard() {
  const g = new Chess();
  return g.board().map((row) =>
    row.map((c) => (c ? { square: c.square, type: c.type, color: c.color } : null))
  );
}

describe("Board", () => {
  it("renders 64 squares and shows dots on legal targets", () => {
    const { container } = render(
      <Board board={freshBoard()} selected="e2" legalTargets={["e3", "e4"]} onSquareClick={() => {}} />
    );
    expect(container.querySelectorAll("[data-square]").length).toBe(64);
    expect(container.querySelectorAll("[data-dot]").length).toBe(2);
  });

  it("calls onSquareClick with the clicked square", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Board board={freshBoard()} selected={null} legalTargets={[]} onSquareClick={onClick} />
    );
    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;
    fireEvent.click(e2);
    expect(onClick).toHaveBeenCalledWith("e2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Board.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/Board.tsx`:
```tsx
import { PieceSprite, } from "./PieceSprite";
import { PieceType } from "../lib/pieceSprites";

export type BoardPiece = { square: string; type: PieceType; color: "w" | "b" } | null;

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

// chess.js board() returns rank 8 first (index 0) down to rank 1 (index 7).
function squareName(rowIdx: number, colIdx: number): string {
  return `${FILES[colIdx]}${8 - rowIdx}`;
}

export function Board({
  board,
  selected,
  legalTargets,
  onSquareClick,
}: {
  board: BoardPiece[][];
  selected: string | null;
  legalTargets: string[];
  onSquareClick: (sq: string) => void;
}) {
  return (
    <div className="grid grid-cols-8 aspect-square w-full max-w-[560px] relative select-none">
      {board.map((row, r) =>
        row.map((cell, c) => {
          const sq = squareName(r, c);
          const dark = (r + c) % 2 === 1;
          const isSel = selected === sq;
          const isTarget = legalTargets.includes(sq);
          return (
            <div
              key={sq}
              data-square={sq}
              onClick={() => onSquareClick(sq)}
              className={`relative flex items-center justify-center cursor-pointer ${
                dark ? "bg-[#7d945d]" : "bg-[#eeeed2]"
              } ${isSel ? "outline outline-2 outline-yellow-400 -outline-offset-2" : ""}`}
            >
              {cell && (
                <div className="w-[88%] h-[88%]">
                  <PieceSprite type={cell.type} color={cell.color} />
                </div>
              )}
              {isTarget && (
                <span
                  data-dot
                  className={`absolute rounded-full ${
                    cell ? "w-full h-full border-4 border-black/30" : "w-1/3 h-1/3 bg-black/30"
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Board.test.tsx`
Expected: PASS — 64 squares, 2 dots, click fires with `"e2"`.

- [ ] **Step 5: Commit**

```bash
git add src/components/Board.tsx src/components/Board.test.tsx
git commit -m "feat: add board with click-to-move and dot hints"
```

---

### Task 7: Status banner and move history

**Files:**
- Create: `src/components/StatusBanner.tsx`
- Create: `src/components/MoveHistory.tsx`
- Test: `src/components/StatusBanner.test.tsx`

**Interfaces:**
- Produces:
  - `type GameStatus = "playing" | "check" | "checkmate" | "stalemate" | "draw"`
  - `<StatusBanner status={GameStatus} aiError={string|null} winner={"w"|"b"|null} />`
  - `<MoveHistory moves={string[]} />` — renders SAN moves paired by move number.

- [ ] **Step 1: Write the failing test**

Create `src/components/StatusBanner.test.tsx`:
```tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBanner } from "./StatusBanner";

describe("StatusBanner", () => {
  it("shows checkmate winner", () => {
    const { getByText } = render(<StatusBanner status="checkmate" aiError={null} winner="w" />);
    expect(getByText(/checkmate/i)).toBeTruthy();
    expect(getByText(/white/i)).toBeTruthy();
  });
  it("shows AI error when present", () => {
    const { getByText } = render(<StatusBanner status="playing" aiError="LM Studio offline" winner={null} />);
    expect(getByText(/LM Studio offline/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/StatusBanner.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write StatusBanner**

Create `src/components/StatusBanner.tsx`:
```tsx
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
```

- [ ] **Step 4: Write MoveHistory**

Create `src/components/MoveHistory.tsx`:
```tsx
export function MoveHistory({ moves }: { moves: string[] }) {
  const rows: { n: number; white: string; black: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ n: i / 2 + 1, white: moves[i], black: moves[i + 1] ?? "" });
  }
  return (
    <div className="overflow-auto max-h-[400px] text-sm font-mono">
      {rows.map((r) => (
        <div key={r.n} className="flex gap-2">
          <span className="w-6 text-gray-500">{r.n}.</span>
          <span className="w-16">{r.white}</span>
          <span className="w-16">{r.black}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/StatusBanner.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/StatusBanner.tsx src/components/MoveHistory.tsx src/components/StatusBanner.test.tsx
git commit -m "feat: add status banner and move history"
```

---

### Task 8: Settings dialog + localStorage persistence

shadcn's full CLI setup is heavy for one dialog; build a minimal shadcn-styled dialog directly to avoid the dependency churn. ponytail: a plain modal covers it — add the shadcn CLI only if more components are needed later.

**Files:**
- Create: `src/lib/settings.ts`
- Create: `src/components/SettingsDialog.tsx`
- Test: `src/lib/settings.test.ts`

**Interfaces:**
- Consumes: `LmSettings` from `./ai`.
- Produces:
  - `loadSettings(): LmSettings` — reads `localStorage["chess-lm-settings"]`, falling back to defaults `{ baseUrl: "http://localhost:1234/v1", model: "" }`.
  - `saveSettings(s: LmSettings): void`
  - `<SettingsDialog open={boolean} settings={LmSettings} onSave={(s:LmSettings)=>void} onClose={()=>void} />`

- [ ] **Step 1: Write the failing test**

Create `src/lib/settings.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadSettings, saveSettings } from "./settings";

beforeEach(() => localStorage.clear());

describe("settings", () => {
  it("returns defaults when nothing stored", () => {
    expect(loadSettings()).toEqual({ baseUrl: "http://localhost:1234/v1", model: "" });
  });
  it("round-trips saved settings", () => {
    saveSettings({ baseUrl: "http://host/v1", model: "gemma-2" });
    expect(loadSettings()).toEqual({ baseUrl: "http://host/v1", model: "gemma-2" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write settings persistence**

Create `src/lib/settings.ts`:
```ts
import { LmSettings } from "./ai";

const KEY = "chess-lm-settings";
const DEFAULTS: LmSettings = { baseUrl: "http://localhost:1234/v1", model: "" };

export function loadSettings(): LmSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: LmSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
```

- [ ] **Step 4: Write the dialog**

Create `src/components/SettingsDialog.tsx`:
```tsx
import { useState, useEffect } from "react";
import { LmSettings } from "../lib/ai";

export function SettingsDialog({
  open,
  settings,
  onSave,
  onClose,
}: {
  open: boolean;
  settings: LmSettings;
  onSave: (s: LmSettings) => void;
  onClose: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  useEffect(() => {
    setBaseUrl(settings.baseUrl);
    setModel(settings.model);
  }, [settings, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">LM Studio Settings</h2>
        <label className="block text-sm">
          Base URL
          <input className="mt-1 w-full border rounded px-2 py-1" value={baseUrl}
                 onChange={(e) => setBaseUrl(e.target.value)} />
        </label>
        <label className="block text-sm">
          Model name
          <input className="mt-1 w-full border rounded px-2 py-1" value={model}
                 placeholder="e.g. gemma-2-9b-it" onChange={(e) => setModel(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 rounded border" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1 rounded bg-black text-white"
                  onClick={() => { onSave({ baseUrl, model }); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/settings.ts src/components/SettingsDialog.tsx src/lib/settings.test.ts
git commit -m "feat: add settings dialog with localStorage persistence"
```

---

### Task 9: Game state hook (`useChessGame`)

Centralize chess.js orchestration so `App` stays thin and the move/capture/AI flow is testable without the DOM.

**Files:**
- Create: `src/lib/useChessGame.ts`
- Test: `src/lib/useChessGame.test.ts`

**Interfaces:**
- Consumes: `Chess` from chess.js; `getAIMove`, `LmSettings`; `GameStatus`; `CaptureEffect`; `BoardPiece`.
- Produces a hook returning:
  - `board: BoardPiece[][]`, `selected: string|null`, `legalTargets: string[]`, `status: GameStatus`, `winner: "w"|"b"|null`, `history: string[]`, `effects: CaptureEffect[]`, `aiError: string|null`, `aiThinking: boolean`
  - `handleSquareClick(sq: string): void` — implements select/reselect/move; ignores clicks when not the player's turn or while `aiThinking`.
  - `removeEffect(id: number): void`
  - `newGame(): void`
- Also exports a pure helper `computeStatus(game: Chess): { status: GameStatus; winner: "w"|"b"|null }` for direct testing.

- [ ] **Step 1: Write the failing test (pure helper)**

Create `src/lib/useChessGame.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { computeStatus } from "./useChessGame";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/useChessGame.test.ts`
Expected: FAIL — `computeStatus` not defined.

- [ ] **Step 3: Write the hook and helper**

Create `src/lib/useChessGame.ts`:
```ts
import { useCallback, useRef, useState } from "react";
import { Chess } from "chess.js";
import { BoardPiece } from "../components/Board";
import { GameStatus } from "../components/StatusBanner";
import { CaptureEffect } from "../components/CaptureEffectLayer";
import { getAIMove, LmSettings } from "./ai";

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

function toBoard(game: Chess): BoardPiece[][] {
  return game.board().map((row) =>
    row.map((c) => (c ? { square: c.square, type: c.type, color: c.color } : null))
  );
}

export function useChessGame(settings: LmSettings) {
  const gameRef = useRef(new Chess());
  const [board, setBoard] = useState<BoardPiece[][]>(() => toBoard(gameRef.current));
  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [winner, setWinner] = useState<"w" | "b" | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [effects, setEffects] = useState<CaptureEffect[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const effectId = useRef(0);

  const sync = useCallback(() => {
    const g = gameRef.current;
    setBoard(toBoard(g));
    setHistory(g.history());
    const s = computeStatus(g);
    setStatus(s.status);
    setWinner(s.winner);
  }, []);

  const spawnEffect = useCallback((square: string, type: BoardPiece extends null ? never : any, color: "w" | "b") => {
    effectId.current += 1;
    setEffects((prev) => [...prev, { id: effectId.current, square, type, color }]);
  }, []);

  // Apply a move object; emit a capture effect if something was taken.
  const applyMove = useCallback((from: string, to: string) => {
    const g = gameRef.current;
    const target = g.get(to as any);
    const moved = g.move({ from, to, promotion: "q" });
    if (!moved) return false;
    if (moved.captured) {
      // En passant: the captured pawn sits behind the target square.
      const capSquare = moved.flags.includes("e")
        ? `${to[0]}${from[1]}`
        : to;
      const capColor: "w" | "b" = moved.color === "w" ? "b" : "w";
      spawnEffect(capSquare, moved.captured, capColor);
    }
    return true;
  }, [spawnEffect]);

  const runAI = useCallback(async () => {
    const g = gameRef.current;
    if (g.isGameOver() || g.turn() !== "b") return;
    setAiThinking(true);
    setAiError(null);
    try {
      const legal = g.moves();
      const san = await getAIMove(g.fen(), legal, settings);
      const verbose = g.moves({ verbose: true }).find((m) => m.san === san)
        ?? g.moves({ verbose: true }).find((m) => g.move(san) && (g.undo(), true));
      const mv = g.moves({ verbose: true }).find((m) => m.san === san);
      if (mv) applyMove(mv.from, mv.to);
      else g.move(san); // safety: san came from legal list
      sync();
    } catch (e) {
      setAiError("Could not reach LM Studio. Check it's running and open Settings.");
    } finally {
      setAiThinking(false);
    }
  }, [settings, applyMove, sync]);

  const handleSquareClick = useCallback((sq: string) => {
    const g = gameRef.current;
    if (aiThinking || g.isGameOver() || g.turn() !== "w") return;
    const piece = g.get(sq as any);

    if (selected && legalTargets.includes(sq)) {
      applyMove(selected, sq);
      setSelected(null);
      setLegalTargets([]);
      sync();
      // Hand off to AI after React paints the player's move.
      setTimeout(() => { void runAI(); }, 50);
      return;
    }
    if (piece && piece.color === "w") {
      setSelected(sq);
      setLegalTargets(g.moves({ square: sq as any, verbose: true }).map((m) => m.to));
      return;
    }
    setSelected(null);
    setLegalTargets([]);
  }, [selected, legalTargets, aiThinking, applyMove, sync, runAI]);

  const removeEffect = useCallback((id: number) => {
    setEffects((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const newGame = useCallback(() => {
    gameRef.current = new Chess();
    setSelected(null);
    setLegalTargets([]);
    setEffects([]);
    setAiError(null);
    setAiThinking(false);
    sync();
  }, [sync]);

  return {
    board, selected, legalTargets, status, winner, history, effects,
    aiError, aiThinking, handleSquareClick, removeEffect, newGame,
  };
}
```

Note: simplify the `runAI` body when implementing — the canonical form is: get `legal = g.moves()`, `san = await getAIMove(...)`, find the verbose move with matching `.san`, call `applyMove(mv.from, mv.to)`, then `sync()`. Remove the redundant `verbose`/safety lines; they are defensive scaffolding and the `san` always comes from the legal list.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/useChessGame.test.ts`
Expected: PASS — both `computeStatus` cases green.

- [ ] **Step 5: Clean up `runAI` per the note and re-run build**

Edit `runAI` to the canonical form:
```ts
  const runAI = useCallback(async () => {
    const g = gameRef.current;
    if (g.isGameOver() || g.turn() !== "b") return;
    setAiThinking(true);
    setAiError(null);
    try {
      const legal = g.moves();
      const san = await getAIMove(g.fen(), legal, settings);
      const mv = g.moves({ verbose: true }).find((m) => m.san === san);
      if (mv) applyMove(mv.from, mv.to);
      sync();
    } catch {
      setAiError("Could not reach LM Studio. Check it's running and open Settings.");
    } finally {
      setAiThinking(false);
    }
  }, [settings, applyMove, sync]);
```

Run: `npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/useChessGame.ts src/lib/useChessGame.test.ts
git commit -m "feat: add chess game state hook with AI turn + capture effects"
```

---

### Task 10: Wire up App + final integration

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: everything above. No new exports.

- [ ] **Step 1: Write App**

Replace `src/App.tsx`:
```tsx
import { useMemo, useState } from "react";
import { Board } from "./components/Board";
import { MoveHistory } from "./components/MoveHistory";
import { StatusBanner } from "./components/StatusBanner";
import { SettingsDialog } from "./components/SettingsDialog";
import { CaptureEffectLayer } from "./components/CaptureEffectLayer";
import { useChessGame } from "./lib/useChessGame";
import { loadSettings, saveSettings } from "./lib/settings";
import { LmSettings } from "./lib/ai";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export default function App() {
  const [settings, setSettings] = useState<LmSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const game = useChessGame(settings);

  const squareToXY = useMemo(
    () => (sq: string) => {
      const col = FILES.indexOf(sq[0]);
      const row = 8 - Number(sq[1]);
      return { left: `${col * 12.5}%`, top: `${row * 12.5}%` };
    },
    []
  );

  return (
    <div className="min-h-full bg-[#312e2b] text-white flex flex-col items-center gap-4 p-4">
      <h1 className="text-2xl font-bold tracking-widest" style={{ fontFamily: "monospace" }}>
        8-BIT CHESS — vs GEMMA
      </h1>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="relative">
          <Board
            board={game.board}
            selected={game.selected}
            legalTargets={game.legalTargets}
            onSquareClick={game.handleSquareClick}
          />
          <CaptureEffectLayer
            effects={game.effects}
            squareToXY={squareToXY}
            onDone={game.removeEffect}
          />
        </div>

        <div className="w-56 space-y-3">
          <StatusBanner status={game.status} aiError={game.aiError} winner={game.winner} />
          {game.aiThinking && <div className="text-yellow-300 text-sm">Gemma is thinking…</div>}
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded bg-green-600" onClick={game.newGame}>New Game</button>
            <button className="px-3 py-1 rounded bg-gray-600" onClick={() => setShowSettings(true)}>Settings</button>
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
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all test files green (parseMove, ai, PieceSprite, CaptureEffectLayer, Board, StatusBanner, settings, useChessGame).

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open the browser.
Verify: clicking a white piece shows dots; clicking a dot moves it and plays a capture effect on captures; with LM Studio running and a model name set in Settings, Gemma replies as Black; New Game resets. With LM Studio off, a capture/move triggers a red "Could not reach LM Studio" banner instead of crashing.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire up app — board, AI turn, effects, settings, history"
```

---

## Self-Review

**Spec coverage:** Stack (Task 1) ✓; chess.js authority (Tasks 6, 9) ✓; click-to-move + dots (Tasks 6, 9) ✓; 8-bit sprites (Task 4) ✓; per-piece capture effects (Task 5, wired in 9/10) ✓; AI retry + fallback (Tasks 2, 3) ✓; settings dialog + localStorage (Task 8) ✓; game-over detection in spec order (Task 9 `computeStatus`) ✓; status banner + history (Task 7) ✓; player always White / AI Black (Task 9 turn guards) ✓; auto-queen promotion (Task 9 `applyMove`) ✓; LM Studio unreachable → banner not crash (Tasks 3, 9, 10) ✓; en-passant capture-square handling (Task 9) ✓.

**Out-of-scope items** (undo, flip, tray, sound, clock, color select) are not built ✓.

**Placeholder scan:** No TBD/TODO; every code step has full code; the one simplification note in Task 9 is resolved in Step 5 with concrete replacement code.

**Type consistency:** `LmSettings`, `BoardPiece`, `PieceType`, `GameStatus`, `CaptureEffect`, `getAIMove`, `parseMove`, `computeStatus`, `loadSettings`/`saveSettings` are defined once and consumed with matching signatures across tasks.
