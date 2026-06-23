<div align="center">

# ♟️ Local AI Chess

### Play chess against a local LLM — or pit two local models against each other across your Wi‑Fi.

A modern 2D chessboard with **animated piece movement**, driven by models served from
[LM Studio](https://lmstudio.ai/). No backend, no cloud — the browser talks straight to your
local AI.

<br/>

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![LM Studio](https://img.shields.io/badge/LM_Studio-local-7C3AED?style=for-the-badge)

</div>

---

## ✨ Features

| | |
|---|---|
| 🧠 **Local AI opponent** | Any chat model in LM Studio plays as your rival — nothing leaves your machine. |
| 🤝 **AI vs AI over LAN** | Point White and Black at two different LM Studio servers and watch your model battle a friend's on the same Wi‑Fi. |
| 🎬 **Animated movement** | Pieces *slide* between squares; captures fade out as the attacker glides in. |
| 🟢 **Beginner‑friendly** | Click a piece and legal destinations light up as dots. |
| ✅ **Fully legal** | `chess.js` enforces every rule — check, mate, stalemate, draws, en passant, castling, promotion. |
| 🛡️ **Never hangs** | Illegal/garbled AI replies are re‑prompted, then fall back to a random legal move. |
| 🔌 **Connection tester** | A **Test** button per endpoint pings the server and confirms the model is loaded. |

---

## 📑 Table of contents

- [About the system](#-about-the-system)
- [Requirements](#-requirements)
- [Getting started](#-getting-started)
- [How to use](#-how-to-use)
- [Troubleshooting](#-troubleshooting)
- [Development](#-development)
- [Notes & limitations](#-notes--limitations)

---

## 🏗️ About the system

- **Frontend:** Vite + React + TypeScript + Tailwind CSS. No backend — the browser calls
  LM Studio's OpenAI‑compatible HTTP API directly.
- **Rules engine:** [`chess.js`](https://github.com/jhlywa/chess.js) is the single source of
  truth for legality and game state.
- **AI opponent:** the model receives the board (FEN) plus the list of legal moves and must
  pick one. Unparseable/illegal replies are re‑prompted up to 3× and finally fall back to a
  random legal move, so a game never stalls.
- **Two modes:**
  - **You vs AI** — you play White by click‑to‑move; the AI replies as Black.
  - **AI vs AI** — White and Black each run on their own LM Studio endpoint; the match plays
    itself until it ends or you stop it.
- **Animation:** pieces carry stable identities and render in a dedicated layer, so React
  keeps each piece's DOM node across a move and CSS transitions animate the slide.

<details>
<summary><b>📂 Project structure</b></summary>

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

</details>

---

## 📦 Requirements

- **Node.js 18+** and npm
- A modern browser
- **[LM Studio](https://lmstudio.ai/)** with at least one chat model downloaded and its local
  server started (any OpenAI‑compatible local server works).

> **For AI vs AI across two machines**, the machine hosting the *other* side's model must:
> 1. **Enable CORS** in LM Studio (Developer / Server settings).
> 2. **Serve on the local network** — host `0.0.0.0`, not just `127.0.0.1`.
> 3. **Allow the server's port through its firewall** (Windows prompts the first time — allow on private networks).

---

## 🚀 Getting started

```bash
npm install
npm run dev
```

Open the URL Vite prints (default **http://localhost:5173**).

> ⚠️ Keep the app on **http** for LAN play. Served over https, browsers block calls to http
> LM Studio endpoints (mixed‑content).

---

## 🎮 How to use

**1. Start LM Studio** — load a model and start the local server. Note its address/port
(default `http://localhost:1234/v1`) and the exact **model id** shown in LM Studio.

**2. Open Settings** in the app and pick a mode:

<table>
<tr><th>👤 You vs AI</th><th>🤖 AI vs AI</th></tr>
<tr valign="top"><td>

Fill in the **Opponent (Black) AI** — Base URL + model name. Hit **Test** → ✅.

Save, then play White: click a piece (dots show legal moves) and click a destination.

</td><td>

Switch mode to **AI vs AI** and fill in **both** White AI and Black AI.

Each side needs its **own** Base URL **and** model name. For a friend's machine use their
**LAN IP** (`ipconfig` → IPv4), e.g. `http://192.168.1.50:1234/v1` — never `localhost`.

**Test** both → ✅, **Save**, then **Start match**.

</td></tr>
</table>

**3. Controls**

| Button | Mode | What it does |
|---|---|---|
| **Start / Stop match** | AI vs AI | Run or halt the self‑playing match |
| **Retry AI move** | You vs AI | Appears after a failed request — retry once LM Studio is fixed |
| **New Game** | both | Reset the board |

---

## 🩺 Troubleshooting

The **Test** button beside each endpoint pings `/v1/models` and tells you exactly what's wrong:

| Result | Meaning | Fix |
|---|---|---|
| ✅ `OK — N model(s)` | Reachable and the model is loaded | You're good |
| ❌ `reachable, but model "…" isn't loaded` | URL works, **model name** is wrong | Copy the exact model id from LM Studio |
| ❌ `Failed to fetch` | Can't connect | Server not running, wrong address, CORS off, or firewall |

> **`localhost` / `127.0.0.1` only ever means *this* computer.** To reach a friend, use their
> **LAN IP** and make sure their LM Studio serves on the network (not just loopback).

---

## 🛠️ Development

```bash
npm run dev      # dev server
npm test         # run the test suite (Vitest)
npm run build    # type-check + production build
npm run preview  # serve the production build
```

---

## 📝 Notes & limitations

- Pawns auto‑promote to a queen.
- You always play White in **You vs AI** mode.
- Move quality depends entirely on the model you load — small models play loose chess.

<div align="center">
<br/>
<sub>Built with React · TypeScript · Vite · Tailwind · chess.js · LM Studio</sub>
</div>
