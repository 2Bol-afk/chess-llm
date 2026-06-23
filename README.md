# Local AI Chess ♟️

A browser chess game with a **modern 2D board and animated piece movement**, powered by
local LLMs served from [LM Studio](https://lmstudio.ai/). Play against an AI yourself, or
let **two AIs play each other** — including your machine vs. a friend's machine on the same
Wi‑Fi.

---

## About the system

- **Frontend:** Vite + React + TypeScript + Tailwind CSS. No backend — the browser talks
  directly to LM Studio's OpenAI‑compatible HTTP API.
- **Rules engine:** [`chess.js`](https://github.com/jhlywa/chess.js) is the single source of
  truth for legality, check/checkmate, stalemate, draws, en passant, castling and promotion.
- **AI opponent:** the model is given the current board (FEN) plus the list of legal moves
  and asked to pick one. If it replies with something illegal or unparseable, the move is
  re‑prompted (up to 3 times) and finally falls back to a random legal move, so a game never
  hangs on a stubborn model.
- **Two modes:**
  - **You vs AI** — you play White by click‑to‑move (legal destinations are shown as dots);
    the AI replies as Black.
  - **AI vs AI** — White and Black are each driven by their own LM Studio endpoint. The match
    runs itself until the game ends or you stop it. Point one side at your machine and the
    other at a friend's machine on the LAN to watch your models battle.
- **Animation:** pieces have stable identities and **slide** from square to square; captures
  fade the taken piece out as the attacker glides in.

### Project structure

```
src/
  App.tsx                  # layout, mode + match controls
  components/
    Board.tsx              # squares, selection highlight, legal-move dots
    PieceLayer.tsx         # animated, absolutely-positioned pieces
    PieceSprite.tsx        # a single piece (scalable SVG glyph)
    StatusBanner.tsx       # check / checkmate / draw / error text
    MoveHistory.tsx        # SAN move list
    SettingsDialog.tsx     # mode + endpoints + per-endpoint connection test
  lib/
    ai.ts                  # LM Studio calls, retry/fallback, testEndpoint()
    parseMove.ts           # match a model's text reply to a legal move
    useChessGame.ts        # game state, move/animation deltas, AI turn + match loop
    settings.ts            # endpoints + mode, persisted to localStorage
```

---

## Requirements

- **Node.js 18+** and npm
- A modern browser
- **[LM Studio](https://lmstudio.ai/)** with at least one chat model downloaded and its local
  server started. Any OpenAI‑compatible local server works, but LM Studio is what this was
  built against.

For **AI vs AI across two machines**, the machine hosting the *other* side's model must:

1. **Enable CORS** in LM Studio (Developer / Server settings) — otherwise the browser blocks
   the request.
2. **Serve on the local network** (host `0.0.0.0`, not just `127.0.0.1`) so other devices can
   reach it.
3. **Allow the server's port through its firewall** (Windows usually prompts the first time —
   allow it on private networks).

---

## How to use

### 1. Install and run

```bash
npm install
npm run dev
```

Open the URL Vite prints (default http://localhost:5173).

> Keep the app on **http** for LAN play. If you ever serve it over https, browsers block
> calls to http LM Studio endpoints (mixed content).

### 2. Start LM Studio

In LM Studio, load a model and start the local server. Note its address and port — by default
`http://localhost:1234/v1`. The exact **model id** shown in LM Studio is what you'll enter as
the model name.

### 3. Configure in the app

Click **Settings**:

- **You vs AI:** fill in the **Opponent (Black) AI** — Base URL (e.g. `http://localhost:1234/v1`)
  and the model name. Hit **Test** to confirm it shows ✅. Save, then play White by clicking a
  piece (dots show where it can go) and clicking a destination.

- **AI vs AI:** switch the mode to **AI vs AI**, then fill in **both** White AI and Black AI:
  - Each side needs its **own** Base URL **and** model name (they are separate configs — using
    the same URL is not enough).
  - For a friend's machine, use their **LAN IP**, not `127.0.0.1`/`localhost`. Find it on their
    machine with `ipconfig` (Windows) → IPv4 Address, e.g. `http://192.168.1.50:1234/v1`.
  - Hit **Test** under each endpoint until both show ✅, then **Save** and click **Start match**.

### Testing a connection

The **Test** button next to each endpoint pings `/v1/models` and reports:

- ✅ `OK — N model(s)` — reachable and the model name is loaded.
- ❌ `reachable, but model "…" isn't loaded` — fix the **model name** to match what's loaded.
- ❌ `Failed to fetch` — not running, wrong address, CORS off, or blocked by a firewall.

### Buttons

- **Start match / Stop match** (AI vs AI) — run or halt the self‑playing match.
- **Retry AI move** (You vs AI) — appears if the opponent's request failed; retry after fixing
  LM Studio.
- **New Game** — reset the board.

---

## Development

```bash
npm run dev      # dev server
npm test         # run the test suite (Vitest)
npm run build    # type-check + production build
npm run preview  # serve the production build
```

---

## Notes & limitations

- Pawns auto‑promote to a queen.
- You always play White in *You vs AI* mode.
- Move quality depends entirely on the model you load — small models play loose chess.
