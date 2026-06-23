import { parseMove } from "./parseMove";

export type LmSettings = { baseUrl: string; model: string };

const MAX_ATTEMPTS = 3;

function buildMessages(fen: string, legalMoves: string[], lastBad?: string) {
  // The side to move is encoded in the FEN ("w"/"b" in field 2).
  const side = fen.split(" ")[1] === "w" ? "White" : "Black";
  const system =
    `You are a chess engine playing ${side}. Reply with ONLY one move in ` +
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
      let detail = "";
      try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
      // 404 / "model not found" almost always means the model name is wrong or
      // not loaded — surface that instead of a generic failure.
      throw new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
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

// Ping an endpoint's /models so the user can verify reachability + that the model
// name they typed is actually loaded — without playing a move.
export async function testEndpoint(
  settings: LmSettings,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetchImpl(`${settings.baseUrl}/models`, { method: "GET" });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const data = await res.json();
    const ids: string[] = (data?.data ?? []).map((m: { id: string }) => m.id);
    if (settings.model && !ids.includes(settings.model)) {
      return { ok: false, detail: `reachable, but model "${settings.model}" isn't loaded there` };
    }
    return { ok: true, detail: `OK — ${ids.length} model(s)${settings.model ? "" : "; pick a model name"}` };
  } catch (e) {
    // fetch rejects on connection refused / DNS / CORS preflight failure.
    return { ok: false, detail: e instanceof Error ? e.message : "connection failed" };
  }
}
